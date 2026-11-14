import crypto from 'node:crypto';

/**
 * Legal-title verification is intentionally authority-gated.
 * A blockchain application cannot independently certify statutory title.
 * This module accepts a signed verification assertion from an authorised
 * land-record authority and binds it to the exact document digest.
 */
export function buildAuthorityVerification({documentSha256, authorityId, sourceReference, verifiedAt, decision, signature}) {
  if (!documentSha256 || !authorityId || !sourceReference || !verifiedAt || !decision || !signature) throw new Error('Incomplete authority verification assertion');
  if (!['VERIFIED','REJECTED'].includes(decision)) throw new Error('Invalid decision');
  const payload=JSON.stringify({documentSha256,authorityId,sourceReference,verifiedAt,decision});
  return {payload, assertionHash:crypto.createHash('sha256').update(payload).digest('hex'), signature};
}
export function titleVerificationStatus(assertion, expectedDocumentSha256) {
  if (!assertion) return {status:'PENDING_AUTHORITY', reason:'No authorised title verification assertion supplied.'};
  if (assertion.documentSha256!==expectedDocumentSha256) return {status:'REJECTED', reason:'Authority assertion is bound to a different document digest.'};
  return assertion.decision==='VERIFIED'
    ? {status:'AUTHORITY_VERIFIED', sourceReference:assertion.sourceReference, authorityId:assertion.authorityId}
    : {status:'AUTHORITY_REJECTED', sourceReference:assertion.sourceReference, authorityId:assertion.authorityId};
}
