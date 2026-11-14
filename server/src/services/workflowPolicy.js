function normalize(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
}
function sameParcelScope(candidate, existing) {
  if (String(candidate.stateCode || '') !== String(existing.stateCode || '')) return false;
  if (normalize(candidate.parcelNumber) !== normalize(existing.parcelNumber)) return false;
  const candidateCode = String(candidate.districtSourceLgdCode || '').trim();
  const existingCode = String(existing.districtSourceLgdCode || '').trim();
  if (candidateCode && existingCode) return candidateCode === existingCode;
  return normalize(candidate.districtName) === normalize(existing.districtName);
}
function hasDuplicateParcel(candidate, properties) {
  return (properties || []).some((item) => String(item.id) !== String(candidate.id || '') && sameParcelScope(candidate, item));
}
function canProposeTransfer({ property, userId, transfers = [] }) {
  if (!property || property.status !== 'APPROVED') return { allowed: false, reason: 'PROPERTY_NOT_WORKFLOW_APPROVED' };
  if (String(property.ownerId) !== String(userId)) return { allowed: false, reason: 'NOT_CURRENT_CLAIMANT' };
  if (transfers.some((item) => String(item.propertyId) === String(property.id) && ['PROPOSED', 'ACCEPTED'].includes(item.status))) {
    return { allowed: false, reason: 'OPEN_TRANSFER_EXISTS' };
  }
  return { allowed: true, reason: 'ELIGIBLE_FOR_WORKFLOW_PROPOSAL' };
}
function canAcceptTransfer({ transfer, userId }) {
  if (!transfer || transfer.status !== 'PROPOSED') return { allowed: false, reason: 'TRANSFER_NOT_PROPOSED' };
  if (String(transfer.buyerId) !== String(userId)) return { allowed: false, reason: 'NOT_DESIGNATED_BUYER' };
  return { allowed: true, reason: 'ELIGIBLE_FOR_BUYER_ACCEPTANCE' };
}
function canFinalizeTransfer({ transfer, property }) {
  if (!transfer || transfer.status !== 'ACCEPTED') return { allowed: false, reason: 'TRANSFER_NOT_ACCEPTED' };
  if (!property || String(property.ownerId) !== String(transfer.sellerId) || property.status !== 'APPROVED') {
    return { allowed: false, reason: 'CLAIMANT_REFERENCE_MISMATCH' };
  }
  return { allowed: true, reason: 'ELIGIBLE_FOR_WORKFLOW_FINALIZATION' };
}
function evaluateWorkflowCases() {
  const p = { id: 'p1', parcelNumber: 'AB-101', stateCode: 'WB', districtName: 'Bardhaman', districtSourceLgdCode: '301', status: 'APPROVED', ownerId: 'u1' };
  const otherState = { ...p, id: 'p2', stateCode: 'KA', districtName: 'Bengaluru Urban', districtSourceLgdCode: '572' };
  const cases = [
    { id: 'W01', type: 'CLEAN_NEW_PARCEL', expected: 'ALLOW', actual: hasDuplicateParcel(p, []) ? 'REJECT' : 'ALLOW' },
    { id: 'W02', type: 'DUPLICATE_SAME_ADMIN_SCOPE', expected: 'REJECT', actual: hasDuplicateParcel(p, [{ ...p, id: 'p-duplicate' }]) ? 'REJECT' : 'ALLOW' },
    { id: 'W03', type: 'SAME_IDENTIFIER_DIFFERENT_STATE', expected: 'ALLOW', actual: hasDuplicateParcel(p, [otherState]) ? 'REJECT' : 'ALLOW' },
    { id: 'W04', type: 'PROPOSAL_BY_NON_CLAIMANT', expected: 'REJECT', actual: canProposeTransfer({ property: p, userId: 'u2' }).allowed ? 'ALLOW' : 'REJECT' },
    { id: 'W05', type: 'PROPOSAL_WITHOUT_REVIEW', expected: 'REJECT', actual: canProposeTransfer({ property: { ...p, status: 'PENDING' }, userId: 'u1' }).allowed ? 'ALLOW' : 'REJECT' },
    { id: 'W06', type: 'DESIGNATED_BUYER_ACCEPTS_PROPOSAL', expected: 'ALLOW', actual: canAcceptTransfer({ transfer: { id: 't1', status: 'PROPOSED', buyerId: 'u2' }, userId: 'u2' }).allowed ? 'ALLOW' : 'REJECT' },
    { id: 'W07', type: 'UNAUTHORISED_BUYER_ACCEPTANCE', expected: 'REJECT', actual: canAcceptTransfer({ transfer: { id: 't1', status: 'PROPOSED', buyerId: 'u2' }, userId: 'u3' }).allowed ? 'ALLOW' : 'REJECT' },
    { id: 'W08', type: 'FINALIZE_ACCEPTED_WORKFLOW', expected: 'ALLOW', actual: canFinalizeTransfer({ transfer: { status: 'ACCEPTED', sellerId: 'u1' }, property: p }).allowed ? 'ALLOW' : 'REJECT' },
    { id: 'W09', type: 'FINALIZE_AFTER_CLAIMANT_CHANGED', expected: 'REJECT', actual: canFinalizeTransfer({ transfer: { status: 'ACCEPTED', sellerId: 'u1' }, property: { ...p, ownerId: 'u9' } }).allowed ? 'ALLOW' : 'REJECT' },
    { id: 'W10', type: 'FINALIZE_BEFORE_BUYER_ACCEPTANCE', expected: 'REJECT', actual: canFinalizeTransfer({ transfer: { status: 'PROPOSED', sellerId: 'u1' }, property: p }).allowed ? 'ALLOW' : 'REJECT' }
  ];
  return cases;
}
module.exports = { sameParcelScope, hasDuplicateParcel, canProposeTransfer, canAcceptTransfer, canFinalizeTransfer, evaluateWorkflowCases };
