const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
function run(command,args,input){try{return execFileSync(command,args,{input,encoding:'utf8',maxBuffer:12*1024*1024,timeout:30000});}catch{return '';}}
function extractText(file){
  const name=String(file.originalname||'').toLowerCase(), mime=String(file.mimetype||'').toLowerCase();
  if(mime.startsWith('text/')||/\.(txt|csv|json|xml|html?)$/.test(name)) return Buffer.from(file.buffer).toString('utf8');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'landledger-doc-'));
  try{
    if(mime==='application/pdf'||name.endsWith('.pdf')){
      const pdf=path.join(dir,'document.pdf');fs.writeFileSync(pdf,file.buffer);
      let text=run('pdftotext',['-layout',pdf,'-']);
      if(!text.trim()){const prefix=path.join(dir,'page');run('pdftoppm',['-f','1','-singlefile','-png','-r','220',pdf,prefix]);const png=prefix+'.png';if(fs.existsSync(png)) text=run('tesseract',[png,'stdout','--psm','6']);}
      return text;
    }
    if(mime.startsWith('image/')||/\.(png|jpe?g|webp|tiff?)$/.test(name)){
      const ext=name.endsWith('.png')?'.png':'.jpg', image=path.join(dir,'document'+ext);fs.writeFileSync(image,file.buffer);return run('tesseract',[image,'stdout','--psm','6']);
    }
    return '';
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
}
function clean(v){return v?String(v).replace(/\s+/g,' ').trim():null;}
function extractEntities(text){
  const n=clean(text)||'';
  const survey=n.match(/(?:survey|parcel|plot)\s*(?:no|number|id)?[\s:#-]*([A-Z0-9][A-Z0-9./_-]{2,})/i)?.[1]||null;
  const owner=n.match(/(?:registered\s+owner|owner|proprietor)\s*[\s:#-]*([A-Za-z][A-Za-z .'-]{2,80}?)(?=\s+(?:area|address|location|survey|parcel|plot|village|district)\b|$)/i)?.[1]?.trim()||null;
  const area=n.match(/(?:area|extent)\s*[\s:#-]*([0-9]+(?:\.[0-9]+)?)\s*(?:sq\.?\s*m|sqm|m2|square\s+met(?:er|re)s?)/i)?.[1]||null;
  const address=n.match(/(?:address|location|situated\s+at)\s*[\s:#-]*(.{8,160}?)(?=\s+(?:area|survey|parcel|owner)\b|$)/i)?.[1]?.trim()||null;
  return {survey,owner:clean(owner),area:area?Number(area):null,address:clean(address)};
}
function norm(s){return clean(s)?.toLowerCase().replace(/[^a-z0-9]/g,'')||'';}
function similarity(a,b){a=norm(a);b=norm(b);if(!a||!b)return 0;if(a===b)return 1;if(a.includes(b)||b.includes(a))return 0.85;let same=0;for(const c of new Set(a))same+=Math.min(a.split(c).length-1,b.split(c).length-1);return same/Math.max(a.length,b.length,1);}
function validateDocument(file,expected={}){
  const text=extractText(file), entities=extractEntities(text), lower=text.toLowerCase();
  const suspiciousTerms=['forged','fake document','altered','specimen','sample only','fraudulent','counterfeit','unauthorised','unauthorized'].filter(t=>lower.includes(t));
  const checks={
    readableText:Boolean(text.trim()), surveyPresent:Boolean(entities.survey||expected.parcelNumber), claimantNamePresent:Boolean(entities.owner||expected.ownerName),
    addressPresent:Boolean(entities.address||expected.address), areaPresent:Boolean(entities.area||expected.areaSqm), suspiciousTerms:suspiciousTerms.length>0,
    parcelMismatch:Boolean(entities.survey&&expected.parcelNumber&&similarity(entities.survey,expected.parcelNumber)<0.75),
    claimantNameMismatch:Boolean(entities.owner&&expected.ownerName&&similarity(entities.owner,expected.ownerName)<0.55),
    areaMismatch:Boolean(entities.area&&expected.areaSqm&&Math.abs(Number(entities.area)-Number(expected.areaSqm))/Math.max(Number(expected.areaSqm),1)>0.10)
  };
  const hard=[checks.parcelMismatch,checks.claimantNameMismatch,checks.areaMismatch,checks.suspiciousTerms].filter(Boolean).length;
  const missing=[checks.readableText,checks.surveyPresent,checks.claimantNamePresent,checks.addressPresent,checks.areaPresent].filter(v=>!v).length;
  const semanticScore=Math.max(0,Math.min(1,1-hard*0.25-missing*0.10));
  const decision=hard>0||semanticScore<0.70?'REVIEW':'PASS';
  const consistencyScore=Number((semanticScore*(checks.readableText?1:0.5)).toFixed(3));
  return {engine:'tesseract-ocr-pdf-text-pattern-consistency-v3',sha256:crypto.createHash('sha256').update(file.buffer).digest('hex'),extractedTextPreview:clean(text)?.slice(0,1200)||'',entities,checks,suspiciousTerms,warnings:[
    ...(!checks.readableText?['No machine-readable text could be extracted; authority visual review is required.']:[]),
    ...(checks.parcelMismatch?['Parcel/survey identifier conflicts with the property record.']:[]),
    ...(checks.claimantNameMismatch?['Extracted claimant-name text is inconsistent with the self-reported account name.']:[]),
    ...(checks.areaMismatch?['Extracted area differs by more than 10% from the property record.']:[]),
    ...(checks.suspiciousTerms?['Suspicious terms detected; this is a screening signal, not proof of fraud.']:[])
  ],semanticScore,consistencyScore,decision,generatedAt:new Date().toISOString(),legalBoundary:'Integrity and semantic consistency screening only; OCR/pattern checks are heuristic only; legal identity and statutory title require authorised verification.'};
}
module.exports={validateDocument};
