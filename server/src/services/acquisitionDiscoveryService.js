'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DATA_DIR = path.resolve(__dirname, '../../data');
const SOURCES_FILE = path.join(DATA_DIR, 'acquisition_discovery_sources.json');
const RESULTS_FILE = path.join(DATA_DIR, 'land_acquisition_discovered.json');
const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 12000;
const TERMS = /land\s*acquisition|acquisition\s*(notice|award|notification|declaration)|award\s*(no\.?|number)?|social\s*impact\s*assessment|\bSIA\b|RFCTLARR|land\s*compensation|possession\s*notice/i;

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function atomicWrite(file, value) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmp, file);
}
function cleanText(value, max = 700) {
  return String(value || '').replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s+/g, ' ').trim().slice(0, max);
}
function assertAllowedSource(source) {
  const u = new URL(source.url);
  if (u.protocol !== 'https:' || u.hostname.toLowerCase() !== source.allowedHost) throw new Error(`Source ${source.id} failed the HTTPS allowlist check.`);
  if (!/(^|\.)gov\.in$|(^|\.)nic\.in$/.test(u.hostname) && !['egazette.gov.in','eoffice.kerala.gov.in','riico.rajasthan.gov.in','gmada.gov.in'].includes(u.hostname)) {
    throw new Error(`Source ${source.id} is not an approved official host.`);
  }
  return u;
}
function parseDate(text) {
  const m = String(text).match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})\b/);
  if (!m) return null;
  const d = `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
  const date = new Date(`${d}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) ? null : d;
}
function extractCandidates(html, pageUrl, source) {
  const candidates = [];
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorPattern.exec(String(html || ''))) !== null) {
    const attrs = match[1];
    const href = attrs.match(/\bhref\s*=\s*['"]([^'"]+)['"]/i)?.[1];
    let title = cleanText(match[2], 700) || cleanText(attrs.match(/\btitle\s*=\s*['"]([^'"]+)['"]/i)?.[1], 700);
    // Some government award catalogues label every PDF link only as "Download".
    // Recover the enclosing table-row text so the award number and village are
    // retained instead of dropping those official source documents.
    if (!TERMS.test(title)) {
      const before = String(html || '').slice(0, match.index);
      const rowStart = before.toLowerCase().lastIndexOf('<tr');
      const rowEnd = String(html || '').toLowerCase().indexOf('</tr>', match.index);
      if (rowStart >= 0 && rowEnd >= match.index) {
        const rowHtml = String(html || '').slice(rowStart, rowEnd + 5);
        const rowTitle = cleanText(rowHtml, 700);
        if (/\baward\b/i.test(rowTitle)) title = rowTitle;
      }
    }
    if (!href || !title || !TERMS.test(title)) continue;
    let absolute;
    try { absolute = new URL(href, pageUrl); } catch { continue; }
    if (absolute.protocol !== 'https:' || absolute.hostname.toLowerCase() !== source.allowedHost) continue;
    const combined = `${title} ${absolute.pathname}`;
    const date = parseDate(combined);
    const parcelTokens = [...new Set((title.match(/(?:survey|sy\.?\s*no\.?|s\.?\s*no\.?|r\.?s\.?\s*no\.?|khasra|dag)\s*(?:no\.?|number)?\s*[.:#-]?\s*[A-Za-z0-9/()\-]+/gi) || []).map((v) => v.slice(0, 120)))];
    const areaTokens = (title.match(/\b\d{1,3}[\s-]\d{1,3}[\s-]\d{1,3}\s*(?:H\.?A\.?Ca\.?|hectares?|ha)\b|\b\d+(?:\.\d+)?\s*(?:hectares?|ha|acres?)\b/gi) || []).slice(0, 10);
    candidates.push({
      candidateId: crypto.createHash('sha256').update(`${source.id}|${absolute.toString()}|${title}`).digest('hex').slice(0, 24),
      sourceId: source.id, stateCode: source.stateCode, state: source.state, district: source.district,
      authority: source.authority, title, pageUrl, candidateUrl: absolute.toString(),
      publishedDateCandidate: date, parcelIdentifierCandidates: parcelTokens,
      landExtentCandidates: areaTokens,
      reviewStatus: 'DISCOVERED_REQUIRES_AUTHORITY_REVIEW',
      warning: 'Search/index metadata only. Do not treat as an award, paid compensation, possession or final acquired status without reviewing the original document.'
    });
  }
  return candidates;
}
async function fetchBounded(url, { fetchImpl = global.fetch } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      method: 'GET', redirect: 'manual', signal: controller.signal,
      headers: { Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1', 'User-Agent': 'LandLedger-Official-Index-Discovery/1.0' }
    });
    if (response.status >= 300 && response.status < 400) throw new Error('Redirects are not followed automatically; add the destination host to the allowlist after review.');
    if (!response.ok) throw new Error(`Official source returned HTTP ${response.status}.`);
    const type = String(response.headers.get('content-type') || '').toLowerCase();
    if (!type.includes('text/html') && !type.includes('application/xhtml')) throw new Error(`Expected an HTML index; received ${type || 'unknown content type'}.`);
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > MAX_BYTES) throw new Error('Official index exceeds the configured 5 MB limit.');
    const reader = response.body?.getReader?.();
    if (!reader) {
      const text = await response.text();
      if (Buffer.byteLength(text) > MAX_BYTES) throw new Error('Official index exceeds the configured 5 MB limit.');
      return text;
    }
    let size = 0; const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error('Official index exceeds the configured 5 MB limit.'); }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString('utf8');
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Official source request timed out.');
    throw error;
  } finally { clearTimeout(timer); }
}
function listSources() {
  const data = readJson(SOURCES_FILE, { sources: [] });
  return { count: data.sources.length, sources: data.sources.map(({ id, stateCode, state, district, authority, url, kind, scope }) => ({ id, stateCode, state, district, authority, url, kind, scope })) };
}
function listCandidates() {
  const data = readJson(RESULTS_FILE, { candidates: [] });
  return { count: data.candidates.length, candidates: data.candidates };
}
async function discover({ sourceIds, fetchImpl = global.fetch, persist = true } = {}) {
  const config = readJson(SOURCES_FILE, { sources: [] });
  const requested = Array.isArray(sourceIds) && sourceIds.length ? new Set(sourceIds.map(String)) : null;
  const matched = config.sources.filter((source) => !requested || requested.has(source.id));
  if (!matched.length) throw new Error('No matching allowlisted acquisition sources were selected.');
  if (requested && matched.length > 8) throw new Error('A single discovery run is limited to 8 official sources. Select at most eight source IDs.');
  const sources = matched.slice(0, 8);
  const results = [];
  for (const source of sources) {
    const url = assertAllowedSource(source);
    try {
      const html = await fetchBounded(url.toString(), { fetchImpl });
      const candidates = extractCandidates(html, url.toString(), source);
      results.push({ sourceId: source.id, sourceUrl: url.toString(), checkedAt: new Date().toISOString(), status: 'FETCHED', candidateCount: candidates.length, candidates });
    } catch (error) {
      results.push({ sourceId: source.id, sourceUrl: url.toString(), checkedAt: new Date().toISOString(), status: 'SOURCE_UNAVAILABLE', candidateCount: 0, error: String(error.message || error).slice(0, 400), candidates: [] });
    }
  }
  const candidates = results.flatMap((r) => r.candidates);
  if (persist && candidates.length) {
    const existing = readJson(RESULTS_FILE, { dataset: 'land_acquisition_discovered', generatedOn: null, candidates: [], runs: [] });
    const seen = new Set((existing.candidates || []).map((c) => c.candidateId));
    const added = candidates.filter((c) => !seen.has(c.candidateId));
    existing.candidates = [...(existing.candidates || []), ...added].slice(-5000);
    existing.generatedOn = new Date().toISOString();
    existing.runs = [...(existing.runs || []), { runAt: new Date().toISOString(), sourceCount: results.length, fetchedCount: results.filter((r) => r.status === 'FETCHED').length, foundCandidates: candidates.length, insertedCandidates: added.length }].slice(-100);
    atomicWrite(RESULTS_FILE, existing);
  }
  return { sourceCount: results.length, skippedSourceCount: Math.max(0, matched.length - sources.length), fetchedCount: results.filter((r) => r.status === 'FETCHED').length, candidateCount: candidates.length, results, warning: 'Candidates are not acquisition facts until an authority reviews and imports the source document.' };
}

module.exports = { listSources, listCandidates, discover, extractCandidates, assertAllowedSource };
