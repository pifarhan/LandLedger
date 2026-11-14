'use strict';

const BASE_URL = 'https://indiapropertyregister.com/api/v1';
const DOCS_URL = 'https://indiapropertyregister.com/api/docs';
const TERMS_URL = 'https://indiapropertyregister.com/terms';
const PRIVACY_URL = 'https://indiapropertyregister.com/privacy';
const PLOT_ID = /^P[A-F0-9]{16}$/i;

function config(env = process.env) {
  const apiKey = String(env.IPR_API_KEY || '').trim();
  const timeoutMs = Math.min(Math.max(Number(env.IPR_API_TIMEOUT_MS || 15000), 3000), 30000);
  return { apiKey, timeoutMs, enabled: Boolean(apiKey) };
}

function getStatus(env = process.env) {
  const cfg = config(env);
  return {
    provider: 'India Property Register (independent third-party aggregator)',
    providerType: 'THIRD_PARTY_AGGREGATOR_NOT_GOVERNMENT',
    enabled: cfg.enabled,
    connectionStatus: cfg.enabled ? 'API_KEY_CONFIGURED_NOT_LIVE_TESTED' : 'NOT_CONFIGURED',
    baseUrl: BASE_URL,
    documentation: DOCS_URL,
    terms: TERMS_URL,
    privacy: PRIVACY_URL,
    providerReportedCoverage: {
      statesWithPlotRecords: 28,
      jurisdictions: 36,
      statesWithoutLoadedPlotRecords: ['Arunachal Pradesh', 'Chandigarh', 'Ladakh', 'Meghalaya', 'Mizoram', 'Nagaland', 'Sikkim', 'Uttarakhand'],
      plotCoverageDescription: 'Provider-reported coverage from its land-record API documentation; varies by State and data layer. Verify the live /coverage response before any operational use.',
      reportedPlotScale: 'Not independently established. The provider marketing page claims 20 crore+ plots, while an API documentation stats example shows parcels: 0; use live per-State /coverage and plot lookup results rather than this headline claim.',
      coverageCheckedAt: '2026-11-14'
    },
    allowedUseInThisApplication: 'Single parcel lookup and display of an individual record to the current authorised user; no bulk scraping, bulk export, resale, sublicensing, competing database, or model training/evaluation without provider written licence.',
    lookupMode: 'ON_DEMAND_SINGLE_PARCEL_ONLY',
    recordPersistence: 'DISABLED_BY_DEFAULT',
    accessRequirements: ['Create a provider account and API key', 'Keep IPR_API_KEY in server environment only', 'Confirm provider terms, wallet balance and state/layer coverage before querying'],
    pricingNotice: 'Provider documentation lists ₹0.40 per successful API call; a village-plot lookup followed by a full-plot detail lookup may make two billable calls. Check the provider wallet before use.',
    legalBoundary: 'This is an independent compilation of public records, not a government service or certified copy. A recorded holder is not conclusive legal title; obtain certified source records and independent title review.',
    personLevelRowsBundled: 0,
    bulkExportEnabled: false
  };
}

function requireConfigured(env = process.env, fetchImpl = global.fetch) {
  const cfg = config(env);
  if (!cfg.enabled) {
    const error = new Error('India Property Register is not configured. Create an account, obtain an API key, and set IPR_API_KEY in the server environment.');
    error.status = 503;
    error.code = 'IPR_API_NOT_CONFIGURED';
    throw error;
  }
  if (typeof fetchImpl !== 'function') throw new Error('This Node runtime does not provide fetch(). Use Node.js 18 or newer.');
  return cfg;
}

function boundedText(value, label, maxLength = 160) {
  const text = String(value ?? '').trim();
  if (!text || text.length > maxLength || /[\u0000-\u001f]/.test(text)) throw new Error(`${label} is required and must be at most ${maxLength} characters.`);
  return text;
}

async function requestJson(endpoint, { env = process.env, fetchImpl = global.fetch } = {}) {
  const cfg = requireConfigured(env, fetchImpl);
  const url = new URL(`${BASE_URL}${String(endpoint).startsWith('/') ? endpoint : `/${endpoint}`}`);
  if (url.origin !== new URL(BASE_URL).origin) throw new Error('Blocked external provider URL.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const response = await fetchImpl(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      signal: controller.signal
    });
    const bodyText = await response.text();
    let data;
    try { data = bodyText ? JSON.parse(bodyText) : {}; } catch { data = { message: bodyText.slice(0, 800) }; }
    if (!response.ok) {
      const error = new Error(String(data?.error || data?.message || `Provider returned HTTP ${response.status}.`).slice(0, 500));
      error.status = response.status === 402 ? 402 : (response.status === 429 ? 429 : (response.status >= 500 ? 503 : 502));
      error.code = response.status === 402 ? 'IPR_WALLET_INSUFFICIENT' : (response.status === 429 ? 'IPR_RATE_LIMITED' : 'IPR_UPSTREAM_ERROR');
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('India Property Register request timed out.');
      timeoutError.status = 504;
      timeoutError.code = 'IPR_TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function searchPlaces(query, options = {}) {
  const q = boundedText(query, 'Village/place search', 120);
  const params = new URLSearchParams({ q });
  const result = await requestJson(`/search?${params.toString()}`, options);
  return {
    provider: 'India Property Register',
    sourceType: 'THIRD_PARTY_AGGREGATED_PUBLIC_RECORD_INDEX',
    query: q,
    villages: Array.isArray(result.villages) ? result.villages.slice(0, 50) : [],
    districts: Array.isArray(result.districts) ? result.districts.slice(0, 50) : [],
    states: Array.isArray(result.states) ? result.states.slice(0, 50) : [],
    rawResult: result,
    sourceUrl: DOCS_URL,
    legalBoundary: 'Use the returned LGD village code to identify the exact jurisdiction. Place-name matches are not parcel identity matches.'
  };
}

async function getCoverage(stateLgd, options = {}) {
  const lgdText = boundedText(stateLgd, 'State LGD code', 16);
  if (!/^\d{1,12}$/.test(lgdText)) throw new Error('State LGD code must be numeric.');
  const params = new URLSearchParams({ state: lgdText });
  const result = await requestJson(`/coverage?${params.toString()}`, options);
  return {
    provider: 'India Property Register',
    providerType: 'THIRD_PARTY_AGGREGATOR_NOT_GOVERNMENT',
    stateLgd: Number(lgdText),
    coverage: result,
    sourceUrl: DOCS_URL,
    checkedAt: new Date().toISOString(),
    note: 'Provider-reported coverage only. Confirm each data layer and last-run date; a state row or village listing does not guarantee every plot or holder is present.'
  };
}

async function findPlot(villageLgd, plotNumber, options = {}) {
  const lgdText = boundedText(villageLgd, 'Village LGD code', 16);
  if (!/^\d{1,12}$/.test(lgdText)) throw new Error('Village LGD code must be numeric.');
  const plot = boundedText(plotNumber, 'Survey/khasra/khata/gat/plot number', 80);
  const params = new URLSearchParams({ plot });
  const result = await requestJson(`/village/${encodeURIComponent(lgdText)}/plots?${params.toString()}`, options);
  const matches = Array.isArray(result.matches) ? result.matches.slice(0, 25) : [];
  const related = Array.isArray(result.related) ? result.related.slice(0, 25) : [];
  return {
    provider: 'India Property Register',
    sourceType: 'THIRD_PARTY_AGGREGATED_PUBLIC_RECORD_INDEX',
    villageLgd: Number(lgdText),
    query: plot,
    village: result.village || null,
    matches,
    related,
    resultUrl: result.url || null,
    sourceUrl: DOCS_URL,
    fullDetailFetched: false,
    legalBoundary: 'A plot-number match is not proof that the supplied claimant owns the plot. Select the exact ipr_id only after checking village, record system and plot subdivision.'
  };
}

async function getPlot(iprId, options = {}) {
  const id = boundedText(iprId, 'Provider plot identifier', 30).toUpperCase();
  if (!PLOT_ID.test(id)) throw new Error('The provider plot ID must be P followed by 16 hexadecimal characters. Obtain it from an exact village/plot match.');
  const result = await requestJson(`/plot/${encodeURIComponent(id)}`, options);
  const rawSourceUrl = result.source || result.source_url || result.record_source || null;
  let safeSourceUrl = null;
  try { const parsed = new URL(String(rawSourceUrl || '')); if (parsed.protocol === 'https:') safeSourceUrl = parsed.toString(); } catch { /* Keep invalid/non-HTTPS source as raw data only. */ }
  return {
    provider: 'India Property Register',
    providerType: 'THIRD_PARTY_AGGREGATOR_NOT_GOVERNMENT',
    sourceType: 'THIRD_PARTY_COMPILED_STATE_RECORD',
    iprId: id,
    readOn: result.read_on || result.readOn || result.as_of || null,
    sourceUrl: safeSourceUrl,
    providerRecordUrl: result.url || null,
    record: result,
    receivedAt: new Date().toISOString(),
    persistence: 'NOT_STORED_BY_THIS_CONNECTOR',
    legalBoundary: 'Holder names are shown as published in the underlying State record. The aggregator is not a government authority and its response is not a certified copy, title certificate, mutation order or legal title adjudication. Verify the underlying State record and the holder identity, relation and share.'
  };
}

module.exports = { getStatus, searchPlaces, getCoverage, findPlot, getPlot, requestJson, config };
