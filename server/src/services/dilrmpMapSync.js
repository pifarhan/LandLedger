const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const SOURCE = 'https://www.dilrmp.gov.in/physicalProgressReports/map/state-level';
const DATA_DIR = path.resolve(__dirname, '../../data');
const FILE = path.join(DATA_DIR, 'dilrmp_map_current_mis4.json');
const REGISTRY_FILE = path.join(DATA_DIR, 'official-state-ut-registry.json');
function text(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, ' ').trim();
}
function norm(value) { return text(value).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' '); }
const aliases = new Map([
  ['andaman and nicobar', 'andaman and nicobar islands'], ['andaman nicobar islands', 'andaman and nicobar islands'],
  ['delhi', 'nct of delhi'], ['dadra and nagar haveli and daman diu', 'dadra and nagar haveli and daman and diu'],
  ['jammu kashmir', 'jammu and kashmir'], ['pondicherry', 'puducherry']
]);
function canonical(value) { const n = norm(value); return aliases.get(n) || n; }
function parseRows(html) {
  return [...String(html || '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) =>
    [...match[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map((cell) => text(cell[1]))
  ).filter((cells) => cells.length);
}
function parseMapTable(html, registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'))) {
  const statesByName = new Map(registry.states.map((state) => [canonical(state.name), state]));
  const rows = parseRows(html);
  const candidates = [];
  for (const cells of rows) {
    const stateCell = cells.find((cell) => statesByName.has(canonical(cell)));
    if (!stateCell || cells.length < 8) continue;
    const state = statesByName.get(canonical(stateCell));
    if (!state) continue;
    candidates.push({
      stateCode: state.code,
      state: state.name,
      type: state.type,
      lgdCode: state.lgdCode,
      sourceRowCells: cells,
      sourceColumnCount: cells.length
    });
  }
  const unique = new Map(candidates.map((row) => [row.stateCode, row]));
  return { records: [...unique.values()], rawRows: rows, rowCount: rows.length };
}
function atomicWrite(file, contents) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, contents, { mode: 0o600 });
  fs.renameSync(tmp, file);
}
async function refreshOfficial() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(SOURCE, { signal: controller.signal, headers: { 'user-agent': 'LandLedger academic research prototype/2.0', accept: 'text/html' } });
    if (!response.ok) throw new Error(`DILRMP Map Digitization HTTP ${response.status}`);
    const html = await response.text();
    const parsed = parseMapTable(html);
    if (parsed.records.length !== 36) throw new Error(`Current DILRMP Map Digitization page returned ${parsed.records.length}/36 State/UT rows. Existing snapshot was retained.`);
    const payload = {
      dataset: 'DILRMP MIS 4.0 Map Digitization State/UT-wise raw source rows',
      authority: 'Department of Land Resources, Government of India',
      source: SOURCE,
      retrievedAt: new Date().toISOString(),
      dataAsOf: null,
      sourceColumnSemantics: 'The original report uses multi-row grouped headers. Raw source cells are preserved without guessing ambiguous column mappings.',
      jurisdictionCount: 36,
      coverage: { stateRows: parsed.records.length, distinctStates: new Set(parsed.records.map((row) => row.stateCode)).size },
      records: parsed.records,
      rawHeaderRows: parsed.rawRows.slice(0, 6),
      rawRowCount: parsed.rowCount,
      integrity: { htmlSha256: crypto.createHash('sha256').update(html).digest('hex') },
      scope: 'Current MIS 4.0 map-digitisation progress only. These figures describe administrative map/parcel/ULPIN progress, not title or named owner records.'
    };
    atomicWrite(FILE, JSON.stringify(payload, null, 2));
    return payload;
  } finally { clearTimeout(timer); }
}
function readCurrent() {
  if (!fs.existsSync(FILE)) return { dataset: 'DILRMP MIS 4.0 Map Digitization State/UT-wise', source: SOURCE, status: 'NOT_YET_CAPTURED', records: [], coverage: { stateRows: 0, distinctStates: 0 }, note: 'Use the authority refresh action to attempt a live fetch. The legacy MIS 3.0 snapshot is kept separately.' };
  return JSON.parse(fs.readFileSync(FILE, 'utf8'));
}
module.exports = { refreshOfficial, parseMapTable, parseRows, readCurrent, SOURCE };
