'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const REGISTRY_FILE = path.resolve(__dirname, '../../data/federated_land_records_registry.json');
const RBIH_DOCS = 'https://docs.rbihub.in/unified-lending-interface/next-gen/land-records';
const RBIH_INTEGRATION_GUIDE = 'https://docs.rbihub.in/unified-lending-interface/getting-started/service-integration/lrs';
const VALID_REMOTE_STATES = new Set(['RECEIVED', 'PREPARING', 'VALIDATING', 'EXECUTING', 'TRANSFORMING', 'SIGNING', 'COMPLETED', 'FAILED']);

function readRegistry() {
  const data = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
  if (!Array.isArray(data.records) || data.records.length !== 36) throw new Error('Federated land-record provider registry is incomplete.');
  return data;
}

function runtimeConfig(env = process.env) {
  const enabled = String(env.RBIH_LRS_ENABLED || '').toLowerCase() === 'true';
  const baseUrl = String(env.RBIH_LRS_BASE_URL || '').trim().replace(/\/+$/, '');
  const clientId = String(env.RBIH_LRS_CLIENT_ID || '').trim();
  const bearerToken = String(env.RBIH_LRS_BEARER_TOKEN || '').trim();
  const timeoutMs = Math.min(Math.max(Number(env.RBIH_LRS_TIMEOUT_MS || 15000), 3000), 30000);
  return {
    enabled,
    baseUrl,
    clientId,
    bearerToken,
    timeoutMs,
    queryPath: String(env.RBIH_LRS_QUERY_PATH || '/api/v1/land-records/query'),
    requestPath: String(env.RBIH_LRS_REQUEST_PATH || '/api/v1/land-records/requests'),
    scope: String(env.RBIH_LRS_SCOPE || '1'),
    consentId: String(env.RBIH_LRS_CONSENT_ID || '').trim()
  };
}

function getStatus(env = process.env) {
  const registry = readRegistry();
  const cfg = runtimeConfig(env);
  const configured = cfg.enabled && Boolean(cfg.baseUrl && cfg.clientId && cfg.bearerToken);
  return {
    provider: 'Reserve Bank Innovation Hub — Unified Lending Interface, Next-Gen Land Records Service',
    apiMode: 'ASYNC_SINGLE_PARCEL_QUERY',
    enabled: configured,
    configured,
    connectionStatus: configured ? 'CREDENTIALS_CONFIGURED_NOT_LIVE_TESTED' : 'NOT_CONFIGURED',
    supportedNextGenStates: registry.records.filter((r) => r.nextGenLrs.supported).map((r) => ({
      stateCode: r.stateCode,
      stateName: r.stateName,
      primaryIdentifierLabel: r.nextGenLrs.primaryIdentifierLabel,
      requiredFields: r.nextGenLrs.requiredFields
    })),
    nextGenStateCount: registry.nextGenLrsSupportedCount,
    v3GuideStateCount: registry.uliLrsV3GuideStateCount,
    jurisdictionCount: 36,
    openBulkOwnerExport: false,
    personLevelRowsBundled: 0,
    documentation: RBIH_DOCS,
    integrationGuide: RBIH_INTEGRATION_GUIDE,
    accessRequirements: [
      'Approved RBIH/ULI institutional onboarding (lender or eligible data-service participant)',
      'IP whitelisting and platform credentials',
      'Service subscription and valid JWT access token',
      'A valid, purpose-specific consent artefact/reference where required',
      'Use only for an authorised single-parcel lookup; not for bulk harvesting'
    ],
    limitations: [
      'Next-Gen documented API covers 12 State government backends, not all 36 jurisdictions.',
      'A separate LRS v3 integration guide documents 14 States and requires a consent-id header; that state-wise v3 interface is not configured by this Next-Gen connector.',
      'West Bengal is not in the published 12-state Next-Gen provider list or the 14-state v3 guide; use the official Banglarbhumi citizen/authority workflow.',
      'The API returns source-record information for a parcel query; it is not a nationwide bulk owner database or a conclusive title adjudication.',
      'Credentials are never included in the repository or returned by this status endpoint.'
    ]
  };
}

function normaliseQuery(input, env = process.env) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Provide a parcel lookup object.');
  const registry = readRegistry();
  const stateCode = String(input.stateCode || input.state_code || '').trim().toUpperCase();
  const state = registry.records.find((r) => r.stateCode === stateCode);
  if (!state) throw new Error('Select a valid Indian State/UT code.');
  if (!state.nextGenLrs.supported) {
    throw new Error(`${state.stateName} is not in the documented 12-state Next-Gen LRS provider set. Use its official State land-record portal or an authorised state-specific integration.`);
  }
  const clean = (value, label, max = 180) => {
    const out = String(value ?? '').trim();
    if (!out || out.length > max || /[\u0000-\u001f]/.test(out)) throw new Error(`${label} is required and must be at most ${max} characters.`);
    return out;
  };
  const cfg = runtimeConfig(env);
  const consentReference = clean(input.consentReference || input.consentId || cfg.consentId, 'Consent artefact/reference', 200);
  const district = clean(input.district, 'District');
  const village = clean(input.village || input.villageName, 'Village');
  const primaryIdentifier = clean(input.primaryIdentifier || input.primary_identifier, 'Primary parcel identifier', 120);
  const subDistrict = String(input.subDistrict || input.sub_district || '').trim();
  const secondaryIdentifier = String(input.secondaryIdentifier || input.secondary_identifier || '').trim();
  if (subDistrict.length > 180 || secondaryIdentifier.length > 120) throw new Error('Optional parcel fields exceed their permitted length.');
  return {
    state,
    consentReference,
    payload: {
      state_code: stateCode,
      district,
      village,
      primary_identifier: primaryIdentifier,
      ...(subDistrict ? { sub_district: subDistrict } : {}),
      ...(secondaryIdentifier ? { secondary_identifier: secondaryIdentifier } : {})
    }
  };
}

function makeHeaders(cfg, consentReference, idempotencyKey) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Client-Id': cfg.clientId,
    'X-Idempotency-Key': idempotencyKey,
    Authorization: `Bearer ${cfg.bearerToken}`,
    scope: cfg.scope
  };
  // RBIH's LRS v3 guide requires this header on every ownership/master-data call.
  // It is also forwarded by this adapter as a conservative consent control.
  if (consentReference) headers['consent-id'] = consentReference;
  return headers;
}

async function parseResponse(response) {
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text.slice(0, 1000) }; }
  if (!response.ok) {
    const message = String(body?.message || body?.error?.message || `RBIH LRS request failed with HTTP ${response.status}.`).slice(0, 500);
    const error = new Error(message);
    error.status = response.status >= 500 ? 503 : 502;
    error.code = 'RBIH_LRS_UPSTREAM_ERROR';
    throw error;
  }
  return body;
}

function assertConfigured(env = process.env) {
  const cfg = runtimeConfig(env);
  if (!cfg.enabled || !cfg.baseUrl || !cfg.clientId || !cfg.bearerToken) {
    const error = new Error('RBIH LRS is not configured. Complete institutional onboarding, add the subscribed API base URL/client ID/JWT to server environment variables, and set RBIH_LRS_ENABLED=true.');
    error.status = 503;
    error.code = 'RBIH_LRS_NOT_CONFIGURED';
    throw error;
  }
  let parsed;
  try { parsed = new URL(cfg.baseUrl); } catch { throw new Error('RBIH_LRS_BASE_URL must be a valid HTTPS URL.'); }
  if (parsed.protocol !== 'https:') throw new Error('RBIH_LRS_BASE_URL must use HTTPS.');
  return cfg;
}

async function submitQuery(input, { env = process.env, fetchImpl = global.fetch } = {}) {
  const cfg = assertConfigured(env);
  if (typeof fetchImpl !== 'function') throw new Error('This Node runtime does not provide fetch(). Use Node.js 18 or newer.');
  const { state, consentReference, payload } = normaliseQuery(input, env);
  const idempotencyKey = crypto.createHash('sha256').update(JSON.stringify({
    actor: String(input.actorId || 'authority'), stateCode: state.stateCode,
    district: payload.district, village: payload.village,
    primary_identifier: payload.primary_identifier, consentReference
  })).digest('hex');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const url = new URL(cfg.queryPath, `${cfg.baseUrl}/`).toString();
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: makeHeaders(cfg, consentReference, idempotencyKey),
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const body = await parseResponse(response);
    const requestId = body.request_id || body.requestId;
    if (!requestId || typeof requestId !== 'string' || requestId.length > 200) {
      const error = new Error('RBIH LRS response did not include a valid request_id.');
      error.status = 502;
      error.code = 'RBIH_LRS_INVALID_RESPONSE';
      throw error;
    }
    return {
      requestId,
      remoteStatus: body.status || 'RECEIVED',
      stateCode: state.stateCode,
      stateName: state.stateName,
      primaryIdentifierLabel: state.nextGenLrs.primaryIdentifierLabel,
      consentReference,
      provider: 'RBIH ULI Next-Gen LRS',
      documentation: RBIH_DOCS,
      notice: 'Lookup submitted to an authorised state-backed service. The returned RoR is source evidence and does not itself constitute a final title adjudication.'
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('RBIH LRS request timed out. Retry with the same parcel details after checking service status.');
      timeoutError.status = 504;
      timeoutError.code = 'RBIH_LRS_TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function pollRequest(requestId, { consentReference, env = process.env, fetchImpl = global.fetch } = {}) {
  const cfg = assertConfigured(env);
  if (typeof fetchImpl !== 'function') throw new Error('This Node runtime does not provide fetch(). Use Node.js 18 or newer.');
  const id = String(requestId || '').trim();
  if (!/^req_[A-Za-z0-9_-]{6,196}$/.test(id)) throw new Error('Invalid RBIH LRS request identifier.');
  const consent = String(consentReference || cfg.consentId || '').trim();
  if (!consent) throw new Error('The same consent artefact/reference is required to retrieve the lookup response.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const url = new URL(`${cfg.requestPath.replace(/\/$/, '')}/${encodeURIComponent(id)}`, `${cfg.baseUrl}/`).toString();
    const headers = makeHeaders(cfg, consent, crypto.createHash('sha256').update(`poll:${id}:${consent}`).digest('hex'));
    const response = await fetchImpl(url, { method: 'GET', headers, signal: controller.signal });
    const body = await parseResponse(response);
    const status = String(body.status || '').toUpperCase();
    if (status && !VALID_REMOTE_STATES.has(status)) {
      const error = new Error(`RBIH LRS returned an unknown status: ${status.slice(0, 80)}.`);
      error.status = 502;
      error.code = 'RBIH_LRS_INVALID_STATUS';
      throw error;
    }
    return {
      requestId: id,
      status: status || 'UNKNOWN',
      stage: body.stage || null,
      result: status === 'COMPLETED' ? (body.result || null) : null,
      error: status === 'FAILED' ? (body.error || { message: 'The state provider did not complete this lookup.' }) : null,
      provider: 'RBIH ULI Next-Gen LRS',
      documentation: RBIH_DOCS,
      legalBoundary: 'A source response can support a source-record match; it is not a conclusive title certificate or a mutation order.'
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('RBIH LRS status request timed out.');
      timeoutError.status = 504;
      timeoutError.code = 'RBIH_LRS_TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { getStatus, normaliseQuery, submitQuery, pollRequest, runtimeConfig };
