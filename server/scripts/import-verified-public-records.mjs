#!/usr/bin/env node
/**
 * Import evidence-backed acquisition or parcel records from a JSON file supplied by an authorised operator.
 * This script intentionally does not crawl portals, solve CAPTCHAs, bypass OTP/login or invent missing values.
 * Usage: node server/scripts/import-verified-public-records.mjs acquisition ./records.json
 *        node server/scripts/import-verified-public-records.mjs parcel ./records.json
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [kind, inputPath] = process.argv.slice(2);
const targets = {
  acquisition: { file: 'data/land_acquisition_cases.json', required: ['stateCode','projectName','district','areaHectares','sourceUrl','retrievedAt','recordStatus'] },
  parcel: { file: 'data/parcel_ownership_evidence.json', required: ['stateCode','district','villageOrMouza','parcelIdentifier','sourceRecordId','sourceUrl','retrievedAt','accessBasis'] }
};
function fail(message) { console.error(`IMPORT REJECTED: ${message}`); process.exit(1); }
if (!targets[kind] || !inputPath) fail('Specify kind (acquisition|parcel) and a JSON input file.');
const inputFile = path.resolve(inputPath);
if (!fs.existsSync(inputFile)) fail(`Input file does not exist: ${inputFile}`);
let input;
try { input = JSON.parse(fs.readFileSync(inputFile, 'utf8')); } catch { fail('Input must be valid JSON.'); }
const records = Array.isArray(input) ? input : input.records;
if (!Array.isArray(records) || records.length === 0) fail('Input must contain a non-empty records array.');
const { file, required } = targets[kind];
const target = path.join(root, file);
const existing = JSON.parse(fs.readFileSync(target, 'utf8'));
function isGovernmentUrl(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && (u.hostname === 'gov.in' || u.hostname.endsWith('.gov.in') || u.hostname === 'nic.in' || u.hostname.endsWith('.nic.in')); }
  catch { return false; }
}
function validate(row, index) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) fail(`Record ${index + 1} must be an object.`);
  for (const key of required) if (row[key] === undefined || row[key] === null || String(row[key]).trim() === '') fail(`Record ${index + 1} is missing ${key}.`);
  if (!isGovernmentUrl(row.sourceUrl)) fail(`Record ${index + 1} sourceUrl must be an official *.gov.in or *.nic.in host.`);
  if (Number.isNaN(Date.parse(row.retrievedAt))) fail(`Record ${index + 1} has an invalid retrievedAt timestamp.`);
  if (kind === 'acquisition' && (!Number.isFinite(Number(row.areaHectares)) || Number(row.areaHectares) < 0)) fail(`Record ${index + 1} has invalid areaHectares.`);
  if (kind === 'parcel' && String(row.accessBasis).trim().length < 8) fail(`Record ${index + 1} needs a documented accessBasis.`);
  if (kind === 'parcel') {
    const basis = String(row.accessBasis || '').trim().toUpperCase();
    if (!['PUBLIC_RECORD','AUTHORITY_EXPORT','CONSENTED_SUBMISSION','AUTHORISED_API','CONSENTED_API_LOOKUP'].includes(basis)) fail(`Record ${index + 1} has an unsupported accessBasis.`);
    const forbidden = Object.keys(row).filter((key) => /^(aadhaar|uid|pan|phone|mobile|email|dateOfBirth|dob|ownerId|ownerIdentifier|ownerAddress)$/i.test(key.replace(/[_\s-]/g,'')) && row[key] != null && String(row[key]).trim());
    if (forbidden.length) fail(`Record ${index + 1} contains disallowed personal identifiers/contact details: ${forbidden.join(', ')}.`);
    const ownerNames = Array.isArray(row.ownerNames) ? row.ownerNames.filter((name) => String(name || '').trim()).map((name) => String(name).trim()) : (row.ownerNames ? [String(row.ownerNames).trim()] : []);
    if (ownerNames.length > 100) fail(`Record ${index + 1} contains too many holder names.`);
    const digest = crypto.createHash('sha256').update(JSON.stringify(row)).digest('hex');
    return { ...row, ownerNames, accessBasis: basis, verificationStatus: 'SOURCE_CAPTURED_UNVERIFIED', verifiedByAuthorityId: null, verifiedAt: null, ownerParcelMatchStatus: ownerNames.length ? 'SOURCE_CAPTURED_UNVERIFIED' : 'NO_HOLDER_RELATIONSHIP_CAPTURED', sourceVerification: null, legalTitleStatus: 'NOT_A_LEGAL_TITLE_ADJUDICATION', evidenceSha256: row.evidenceSha256 || digest, importedAt: new Date().toISOString() };
  }
  const serialised = JSON.stringify(row);
  return { ...row, evidenceSha256: row.evidenceSha256 || crypto.createHash('sha256').update(serialised).digest('hex') };
}
const incoming = records.map(validate);
const keyOf = (r) => kind === 'parcel'
  ? `${r.stateCode}|${r.district}|${r.villageOrMouza}|${r.parcelIdentifier}|${r.sourceRecordId || ''}`.toLowerCase()
  : `${r.stateCode}|${r.officialCaseId || r.projectName}|${r.district}|${r.awardDate || ''}`.toLowerCase();
const keys = new Set((existing.records || []).map(keyOf));
let added = 0; let skipped = 0;
for (const row of incoming) {
  const key = keyOf(row);
  if (keys.has(key)) { skipped += 1; continue; }
  keys.add(key); existing.records.push(row); added += 1;
}
existing.lastImportedAt = new Date().toISOString();
existing.importedFromFile = path.basename(inputFile);
fs.writeFileSync(target, `${JSON.stringify(existing, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, kind, added, skippedDuplicates: skipped, total: existing.records.length, output: file }, null, 2));
