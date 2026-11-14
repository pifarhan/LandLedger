'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_TEXT = 2 * 1024 * 1024;
const MAX_OCR_PAGES = 5;
const COMMAND_TIMEOUT = 12000;

function normalise(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('en-IN')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8', timeout: COMMAND_TIMEOUT, maxBuffer: MAX_TEXT,
    windowsHide: true, ...options
  });
  if (result.error) return { ok: false, error: result.error.message, stdout: '' };
  return { ok: result.status === 0, error: result.status === 0 ? null : String(result.stderr || '').slice(0, 600), stdout: String(result.stdout || '') };
}
function extractText({ buffer, filename, mimeType }) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_BYTES) throw new Error('Source document must be a non-empty file up to 10 MB.');
  const ext = path.extname(String(filename || '')).toLowerCase();
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  if (ext === '.txt' || ext === '.csv' || String(mimeType || '').startsWith('text/')) {
    if (buffer.includes(0)) throw new Error('Text source document contains binary bytes.');
    return { text: buffer.toString('utf8').slice(0, MAX_TEXT), extractionMethod: 'TEXT_DECODE', sha256: hash, ocrPages: 0 };
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'landledger-source-'));
  try {
    const inputPath = path.join(tmp, `source${ext === '.pdf' ? '.pdf' : (ext === '.png' ? '.png' : '.jpg')}`);
    fs.writeFileSync(inputPath, buffer, { mode: 0o600, flag: 'wx' });
    if (ext === '.pdf' || String(mimeType || '').includes('pdf')) {
      if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('Uploaded PDF signature is invalid.');
      const native = run('pdftotext', ['-layout', '-enc', 'UTF-8', inputPath, '-']);
      const text = native.ok ? native.stdout.slice(0, MAX_TEXT) : '';
      if (text.replace(/\s/g, '').length >= 40) return { text, extractionMethod: 'PDFTOTEXT', sha256: hash, ocrPages: 0 };
      const prefix = path.join(tmp, 'page');
      const pdfToPng = run('pdftoppm', ['-f', '1', '-l', String(MAX_OCR_PAGES), '-r', '160', '-png', inputPath, prefix]);
      if (pdfToPng.ok) {
        const pages = fs.readdirSync(tmp).filter((name) => /^page-\d+\.png$/.test(name)).sort((a,b) => Number(a.match(/-(\d+)\.png/)[1])-Number(b.match(/-(\d+)\.png/)[1])).slice(0, MAX_OCR_PAGES);
        const ocr = [];
        for (const page of pages) {
          const result = run('tesseract', [path.join(tmp, page), 'stdout', '-l', process.env.LANDLEDGER_OCR_LANGS || 'eng', '--psm', '6']);
          if (result.ok && result.stdout.trim()) ocr.push(result.stdout);
        }
        if (ocr.join('\n').replace(/\s/g, '').length >= 25) return { text: ocr.join('\n').slice(0, MAX_TEXT), extractionMethod: 'PDF_PAGE_OCR', sha256: hash, ocrPages: pages.length };
      }
      return { text: '', extractionMethod: 'NO_TEXT_LAYER_OR_OCR_UNAVAILABLE', sha256: hash, ocrPages: 0, extractionError: native.error || 'No readable text could be extracted.' };
    }
    if (['.png', '.jpg', '.jpeg'].includes(ext)) {
      const result = run('tesseract', [inputPath, 'stdout', '-l', process.env.LANDLEDGER_OCR_LANGS || 'eng', '--psm', '6']);
      return { text: result.ok ? result.stdout.slice(0, MAX_TEXT) : '', extractionMethod: result.ok ? 'IMAGE_OCR' : 'OCR_UNAVAILABLE', sha256: hash, ocrPages: 1, extractionError: result.error || null };
    }
    throw new Error('Only PDF, PNG, JPEG or plain-text source documents can be verified.');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
function includesNormalised(haystack, needle) {
  const a = normalise(haystack), b = normalise(needle);
  if (!a || !b) return false;
  // Full token-sequence match; avoids substring collisions such as plot 12 vs 112.
  return (` ${a} `).includes(` ${b} `);
}
function extractAcquisitionCandidates(extracted) {
  const text = extracted.text || '';
  return {
    acquisitionReferences: [...new Set((text.match(/\b(?:award|case|notification|gazette|SIA|LARR)\s*(?:no\.?|number|id|reference)?\s*[:#-]?\s*[A-Z0-9./-]{3,40}/gi) || []).slice(0, 100))],
    parcelIdentifiers: [...new Set((text.match(/(?:survey\s*(?:no\.?|number)?|s\.?\s*no\.?|r\.?s\.?\s*no\.?|khasra\s*(?:no\.?|number)?|dag\s*(?:no\.?|number)?)\s*[:#-]?\s*[\p{L}\p{N}./()\-]+/giu) || []).slice(0, 200))],
    areaCandidates: [...new Set((text.match(/\b\d+(?:[.,]\d+)?\s*(?:hectares?|hectare|ha|ares?|acre|acres|sq\.?\s*(?:m|ft)|square\s*(?:metres?|meters?|feet))\b|\b\d{1,3}[- ]\d{1,3}[- ]\d{1,3}\s*H\.?A\.?Ca\.?/gi) || []).slice(0, 100))],
    dates: [...new Set((text.match(/\b(?:\d{1,2}[/-]\d{1,2}[/-](?:19|20)\d{2}|(?:19|20)\d{2}-\d{2}-\d{2})\b/g) || []).slice(0, 100))],
    compensationCandidates: [...new Set((text.match(/(?:₹|Rs\.?|INR)\s*[\d,]+(?:\.\d{1,2})?/gi) || []).slice(0, 100))],
    sourceSha256: extracted.sha256, extractionMethod: extracted.extractionMethod, textLength: text.length,
    classification: 'EXTRACTION_CANDIDATE_REQUIRES_AUTHORITY_REVIEW'
  };
}

function inspectParcelSource({ extracted, record, verificationReference }) {
  const text = extracted.text || '';
  const parcelMatch = includesNormalised(text, record.parcelIdentifier);
  const sourceRecordCandidates = [record.sourceRecordId, record.khatianOrRecordNumber, verificationReference].filter(Boolean);
  const sourceReferenceMatch = sourceRecordCandidates.some((value) => includesNormalised(text, value));
  const names = [...new Set([...(record.ownerNames || []), ...((record.holders || []).map((holder) => holder.name).filter(Boolean))])];
  const holderMatches = names.filter((name) => includesNormalised(text, name));
  const holderMismatchCount = Math.max(0, names.length - holderMatches.length);
  const extractedCandidates = {
    surveyIdentifiers: [...new Set((text.match(/(?:survey\s*(?:no\.?|number)?|s\.?\s*no\.?|r\.?s\.?\s*no\.?|khasra\s*(?:no\.?|number)?|dag\s*(?:no\.?|number)?)\s*[:#-]?\s*[\p{L}\p{N}./()\-]+/giu) || []).slice(0, 30))],
    dates: [...new Set((text.match(/\b(?:\d{1,2}[/-]\d{1,2}[/-](?:19|20)\d{2}|(?:19|20)\d{2}-\d{2}-\d{2})\b/g) || []).slice(0, 30))],
    areaCandidates: [...new Set((text.match(/\b\d+(?:\.\d+)?\s*(?:hectares?|hectare|ha|acres?|acre|sq\.?\s*(?:m|ft)|square\s*(?:metres?|meters?|feet))\b/gi) || []).slice(0, 30))]
  };
  return {
    textPresent: text.trim().length >= 25,
    textLength: text.length,
    extractionMethod: extracted.extractionMethod,
    sha256: extracted.sha256,
    sourceReferenceMatch,
    parcelMatch,
    holderCount: names.length,
    holderMatchCount: holderMatches.length,
    holderMismatchCount,
    extractedCandidates
  };
}

module.exports = { extractText, inspectParcelSource, extractAcquisitionCandidates, normalise, includesNormalised };
