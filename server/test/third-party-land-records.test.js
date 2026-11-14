const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../src/services/thirdPartyLandRecordsService');
const configured = { IPR_API_KEY: 'fake-test-key', IPR_API_TIMEOUT_MS: '3000' };
const response = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(payload) });

test('IPR status clearly labels the provider as third-party, no bulk import and no bundled PII', () => {
  const status = service.getStatus({});
  assert.equal(status.enabled, false);
  assert.equal(status.providerType, 'THIRD_PARTY_AGGREGATOR_NOT_GOVERNMENT');
  assert.equal(status.providerReportedCoverage.statesWithPlotRecords, 28);
  assert.equal(status.personLevelRowsBundled, 0);
  assert.equal(status.bulkExportEnabled, false);
});

test('IPR service refuses lookups unless API key is present', async () => {
  await assert.rejects(() => service.searchPlaces('Siliguri', { env: {} }), /not configured/i);
});

test('IPR place search passes provider key in server-side authorization header', async () => {
  const result = await service.searchPlaces('Siliguri', { env: configured, fetchImpl: async (url, options) => {
    assert.equal(new URL(url).origin, 'https://indiapropertyregister.com');
    assert.match(new URL(url).pathname, /\/api\/v1\/search$/);
    assert.equal(options.headers.Authorization, 'Bearer fake-test-key');
    return response({ villages: [{ lgd: 12345, name: 'Sample Village' }] });
  } });
  assert.equal(result.villages[0].lgd, 12345);
});

test('IPR coverage check is state-scoped and labels results provider-reported', async () => {
  const result = await service.getCoverage('19', { env: configured, fetchImpl: async (url) => {
    const parsed = new URL(url);
    assert.match(parsed.pathname, /\/api\/v1\/coverage$/);
    assert.equal(parsed.searchParams.get('state'), '19');
    return response({ state: { lgd: 19, name: 'West Bengal' }, layers: [{ layer: 'ror', records: 2840000, last_run: '2026-10-20' }] });
  } });
  assert.equal(result.stateLgd, 19);
  assert.equal(result.coverage.layers[0].records, 2840000);
  assert.match(result.note, /Provider-reported/);
});

test('IPR parcel search returns exact matches without automatically bulk-listing a village', async () => {
  const result = await service.findPlot('12345', '123/2A', { env: configured, fetchImpl: async (url) => {
    const parsed = new URL(url);
    assert.match(parsed.pathname, /village\/12345\/plots$/);
    assert.equal(parsed.searchParams.get('plot'), '123/2A');
    return response({ matches: [{ ipr_id: 'P3F9A0C2B71E4D5A6', plot_no: '123/2A', holders: 2 }], related: [] });
  } });
  assert.equal(result.matches.length, 1);
  assert.equal(result.fullDetailFetched, false);
  await assert.rejects(() => service.findPlot('x;drop table', '123', { env: configured, fetchImpl: async () => response({}) }), /numeric/);
});

test('IPR full plot detail validates provider ID and returns source/date without persistence', async () => {
  const result = await service.getPlot('P3F9A0C2B71E4D5A6', { env: configured, fetchImpl: async (url) => {
    assert.match(new URL(url).pathname, /plot\/P3F9A0C2B71E4D5A6$/);
    return response({ ipr_id: 'P3F9A0C2B71E4D5A6', holders: [{ name: 'Public-record holder', share: '1/2' }], source: 'https://revenue.example.gov.in/ror', read_on: '2026-10-12', note: 'Not proof of title' });
  } });
  assert.equal(result.record.holders[0].name, 'Public-record holder');
  assert.equal(result.readOn, '2026-10-12');
  assert.equal(result.persistence, 'NOT_STORED_BY_THIS_CONNECTOR');
  await assert.rejects(() => service.getPlot('malicious-id', { env: configured, fetchImpl: async () => response({}) }), /16 hexadecimal/);
});
