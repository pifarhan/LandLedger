const crypto = require('crypto');
const { status: fabricStatus, submit: fabricSubmit } = require('./fabricGatewayService');

function mockRecord(store, event) {
  return store.appendEvent(event);
}

// Fabric stores only keyed references for personal/parcel attributes. The source
// values stay in the authorised off-chain store; HMAC prevents dictionary attacks
// against low-entropy plot IDs/names better than a plain SHA-256 hash.
function fabricReference(value, label) {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new Error(`Missing ${label}; cannot create a Fabric privacy reference.`);
  }
  const secret = process.env.FABRIC_REFERENCE_HMAC_SECRET || '';
  if (Buffer.byteLength(secret) < 32) {
    throw new Error('FABRIC_REFERENCE_HMAC_SECRET must contain at least 32 bytes before Fabric mode can be used.');
  }
  return crypto.createHmac('sha256', secret).update(String(value), 'utf8').digest('hex');
}

function optionalFabricReference(value) {
  return value === undefined || value === null || String(value).trim() === ''
    ? ''
    : fabricReference(value, 'optional value');
}

async function fabricRecord(event) {
  const p = event.payload || {};
  switch (event.action) {
    case 'PROPERTY_REGISTERED':
      const claimantId = p.claimantId || p.ownerId || '';
      const parcelContext = [p.stateCode || '', p.districtSourceLgdCode || '', p.subDistrictSourceLgdCode || '', p.parcelNumber || ''].join('|');
      return fabricSubmit('CreateProperty', [
        event.entityId,
        fabricReference(parcelContext, 'state/district/sub-district/parcel identifier'),
        optionalFabricReference(p.title), optionalFabricReference(p.address),
        fabricReference(claimantId, 'claimant reference'),
        p.landType || '', p.documentHash || '', optionalFabricReference(p.storageKey), Number(p.areaSqm || 0),
        p.stateCode || '', p.stateName || '', p.districtName || '',
        p.districtSourceLgdCode || '', p.subDistrictName || '', p.subDistrictSourceLgdCode || '',
        p.recordOrigin || 'USER_SUBMITTED_UNVERIFIED',
        p.claimantVerificationStatus || 'NOT_VERIFIED',
        p.titleStatus || 'NOT_VERIFIED_BY_STATUTORY_REGISTRY',
        p.adminBoundaryVerification || 'NOT_MATCHED'
      ], 'application');
    case 'PROPERTY_APPROVED':
      return fabricSubmit('ApproveProperty', [event.entityId], 'authority');
    case 'PROPERTY_REJECTED':
      return fabricSubmit('RejectProperty', [event.entityId, fabricReference(p.reason || 'Authority workflow rejected.', 'rejection reason')], 'authority');
    case 'TRANSFER_PROPOSED':
      return fabricSubmit('ProposeTransfer', [
        event.entityId, p.propertyId || '',
        fabricReference(p.sellerId || '', 'seller reference'),
        fabricReference(p.buyerId || '', 'buyer reference')
      ], 'application');
    case 'TRANSFER_ACCEPTED':
      return fabricSubmit('AcceptTransfer', [event.entityId, fabricReference(p.buyerId || '', 'buyer reference')], 'application');
    case 'TRANSFER_REJECTED':
      return fabricSubmit('RejectTransfer', [event.entityId, fabricReference(p.reason || 'Transfer rejected.', 'rejection reason')], 'application');
    case 'TRANSFER_FINALIZED':
      return fabricSubmit('FinalizeTransfer', [event.entityId], 'authority');
    case 'CLAIMANT_REFERENCE_UPDATED':
      return fabricSubmit('MarkClaimantReferenceUpdate', [p.transferId || ''], 'authority');
    case 'AUTHORITY_VERIFIED_SOURCE_RECORD_MATCH':
      return fabricSubmit('RecordSourceEvidence', [p.recordKeySha256, p.sourceDocumentSha256 || '', p.verificationReferenceSha256 || '', p.stateCode || '', p.verificationClass || '', p.verificationMethod || ''], 'authority');
    default:
      throw new Error(`Fabric chaincode transaction is not mapped for event action: ${event.action}`);
  }
}

async function record(store, event, options = {}) {
  const mode = options.fabricMode || process.env.FABRIC_MODE || 'mock';
  if (mode === 'fabric') {
    const result = await fabricRecord(event);
    return { backend: 'fabric', result };
  }
  return { backend: 'mock', result: await mockRecord(store, event) };
}

async function connectionStatus(options = {}) {
  const mode = options.fabricMode || process.env.FABRIC_MODE || 'mock';
  if (mode !== 'fabric') return { mode: 'mock', connected: true, note: 'Local append-only development ledger is active.' };
  return fabricStatus();
}

module.exports = { record, connectionStatus, fabricReference };
