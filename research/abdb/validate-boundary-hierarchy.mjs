import fs from 'node:fs/promises';

// Lightweight validation scaffold. Feed a normalized JSON array with:
// {state,district,subDistrict,village}
// and a reference hierarchy built from ABDB attributes.
const input = process.argv[2];
const reference = process.argv[3];
if (!input || !reference) {
  console.error('Usage: node validate-boundary-hierarchy.mjs <records.json> <abdb-hierarchy.json>');
  process.exit(2);
}
const records = JSON.parse(await fs.readFile(input, 'utf8'));
const ref = JSON.parse(await fs.readFile(reference, 'utf8'));
const norm = v => String(v ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
const allowed = new Set(ref.map(r => [norm(r.state),norm(r.district),norm(r.subDistrict),norm(r.village)].join('|')));
const results = records.map(r => {
  const key = [norm(r.state),norm(r.district),norm(r.subDistrict),norm(r.village)].join('|');
  return {...r, abdbHierarchyMatch: allowed.has(key)};
});
const summary = {records: results.length, matched: results.filter(x=>x.abdbHierarchyMatch).length, unmatched: results.filter(x=>!x.abdbHierarchyMatch).length};
await fs.writeFile('abdb-hierarchy-validation.json', JSON.stringify({summary,results}, null, 2));
console.log(JSON.stringify(summary, null, 2));
