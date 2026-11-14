import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataRoot = path.join(root, 'server/data');
const manifestPath = path.join(dataRoot, 'manifest.json');
const existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const requiredExtras = [
  'acquisition_discovery_sources.json',
  'land_acquisition_discovered.json',
  'land_acquisition_awards_extracted.json',
  'land_acquisition_awards_extracted.csv'
];
const paths = new Set([...Object.keys(existing.files || {}), ...requiredExtras]);
const files = {};
for (const rel of [...paths].sort()) {
  const absolute = path.join(dataRoot, rel);
  if (!fs.existsSync(absolute)) throw new Error(`Manifest entry is missing: ${rel}`);
  const bytes = fs.readFileSync(absolute);
  files[rel] = {
    bytes: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex')
  };
}
const manifest = {
  generatedAt: '2026-11-14',
  policy: 'Checksums cover official public snapshots, source-derived administrative reference data, selected official acquisition award extracts and capability metadata. No person-level owner identity or owner-to-parcel rows are bundled. Hashes establish file integrity after capture, not the truth or legal effect of source records.',
  files
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
const lines = [];
for (const rel of Object.keys(files).sort()) lines.push(`${files[rel].sha256}  ${rel}`);
const rawManifestPath = path.join(dataRoot, 'abdb/raw/manifest.json');
const rawManifest = JSON.parse(fs.readFileSync(rawManifestPath, 'utf8'));
const rawArchiveRel = 'abdb/raw/State_District_Subdistrict_PAN INDIA.rar';
const rawArchivePath = path.join(dataRoot, rawArchiveRel);
const rawHash = crypto.createHash('sha256').update(fs.readFileSync(rawArchivePath)).digest('hex');
if (fs.statSync(rawArchivePath).size !== rawManifest.bytes || rawHash !== rawManifest.sha256) throw new Error('Raw ABDB RAR does not match source archive manifest.');
lines.push(`${rawHash}  ${rawArchiveRel}`);
fs.writeFileSync(path.join(dataRoot, 'CHECKSUMS.sha256'), lines.sort().join('\n') + '\n');
console.log(JSON.stringify({status:'PASS',files:Object.keys(files).length,rawAbdbBytes:rawManifest.bytes,rawAbdbSha256:rawHash},null,2));
