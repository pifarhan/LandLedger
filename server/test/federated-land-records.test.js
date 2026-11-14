const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../src/services/federatedLandRecordsService');

const env = {
  RBIH_LRS_ENABLED: 'true',
  RBIH_LRS_BASE_URL: 'https://sandbox.example.rbihub.io',
  RBIH_LRS_CLIENT_ID: 'test-client',
  RBIH_LRS_BEARER_TOKEN: 'test-token',
  RBIH_LRS_TIMEOUT_MS: '3000'
};
const response = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(payload) });

test('RBIH status describes limited 12-state on-demand coverage and no bundled owner data', () => {
  const status = service.getStatus({});
  assert.equal(status.nextGenStateCount, 12);
  assert.equal(status.jurisdictionCount, 36);
  assert.equal(status.openBulkOwnerExport, false);
  assert.equal(status.personLevelRowsBundled, 0);
  assert.equal(status.configured, false);
});

test('RBIH lookup rejects unsupported State/UT without calling external API', async () => {
  let called = false;
  await assert.rejects(() => service.submitQuery({
    stateCode: 'WB', district: 'Nadia', village: 'Sample', primaryIdentifier: '101', consentReference: 'consent-1'
  }, { env, fetchImpl: async () => { called = true; return response({}); } }), /not in the documented 12-state/);
  assert.equal(called, false);
});

test('RBIH asynchronous single parcel request submits documented identifier and returns request ID', async () => {
  let requestUrl = '';
  let requestBody = null;
  let requestHeaders = null;
  const result = await service.submitQuery({
    stateCode: 'MP', district: 'Bhopal', village: 'Sample', primaryIdentifier: '123/4', consentReference: 'consent-demo-123'
  }, { env, fetchImpl: async (url, options) => {
    requestUrl = url; requestBody = JSON.parse(options.body); requestHeaders = options.headers; return response({ request_id: 'req_abcdef123', status: 'RECEIVED' });
  } });
  assert.match(requestUrl, /api\/v1\/land-records\/query$/);
  assert.deepEqual(requestBody, { state_code: 'MP', district: 'Bhopal', village: 'Sample', primary_identifier: '123/4' });
  assert.equal(requestHeaders['X-Client-Id'], 'test-client');
  assert.equal(requestHeaders['consent-id'], 'consent-demo-123');
  assert.equal(result.requestId, 'req_abcdef123');
});

test('RBIH poll returns record only when provider status is COMPLETED', async () => {
  const result = await service.pollRequest('req_abcdef123', {
    consentReference: 'consent-demo-123', env,
    fetchImpl: async (url) => { assert.match(url, /requests\/req_abcdef123$/); return response({ status: 'COMPLETED', result: { holders: [{ name: 'Example Holder' }], parcel: '123/4' } }); }
  });
  assert.equal(result.status, 'COMPLETED');
  assert.equal(result.result.holders[0].name, 'Example Holder');
  assert.match(result.legalBoundary, /not a conclusive title certificate/);
});
