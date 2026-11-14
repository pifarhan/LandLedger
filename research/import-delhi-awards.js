'use strict';
const service = require('../server/src/services/governmentEnrichmentService');
const base = 'https://revenue.delhi.gov.in/sites/default/files/revenue/land-acquisition-award/';
const rows = [
  {
    stateCode: 'DL', district: 'South West Delhi', projectName: 'Dwarka Phase II, Planned Development of Delhi',
    underAct: 'Land Acquisition Act, 1894', landExtentAsPublished: '2,100 Bigha 06 Biswas; includes 640 Bigha 12 Biswas under High Court status quo',
    landExtentUnitAsPublished: 'Bigha-Biswa',
    parcelIdentifiers: ['8//24','22//4','22//5','22//6','22//7','22//15','22//16','22//21','25//2/1','26//23','26//24','26//25','21//24','21//25','26//14','26//15','25//10/2','25//11','25//19','25//20','25//21','26//4','26//7','26//16','26//17'],
    parcelIdentifierCoverage: 'SUBSET_OF_HIGH_COURT_STATUS_QUO_SCHEDULE', acquisitionStage: 'AWARD_ISSUED',
    stageEvidenceReference: 'AWARD-1(07-08); award summary signed 06-Aug-2007', stageEvidenceUrl: `${base}bamnoli-1_07-08.pdf`, stageEvidenceDate: '2007-08-06',
    notificationDate: '2004-11-04', section4NotificationDate: '2004-11-04', section6NotificationDate: '2005-10-31', awardDate: '2007-08-06',
    compensationAmountInr: 1117572745, compensationStatus: 'AWARD_AMOUNT_PUBLISHED_PAYMENT_NOT_VERIFIED',
    compensationBreakdown: { landMarketValueBlockAAndBInr: 685316441, solatium30PercentInr: 205594932, additional12PercentInr: 226661372, grandTotalInr: 1117572745 },
    possessionStatusNote: 'The award states that 640 Bigha 12 Biswas was covered by High Court status-quo orders; possession could not be taken and title could not change for the affected parcels pending further court direction. Overall possession is not recorded as complete.',
    titleStatusNote: 'No change in title/nature/possession for the stay/status-quo land until court orders vacated or further direction.',
    sourceDataQualityNotes: 'Area retained in Bigha-Biswa; not converted to hectares. Parcel list is a partial schedule extracted from pages 1-4 of the award. Compensation is award total, not proof of disbursement to all claimants.',
    sourceDocumentEvidence: [{page:0,fields:['Village Bamnoli','permanent acquisition','Dwarka Phase II','Section 4 notification date 04-Nov-2004','Section 6 notification date 31-Oct-2005']},{page:4,fields:['Award extent 2,100 Bigha 06 Biswas','640 Bigha 12 Biswas status quo','possession/title cannot change until court direction']},{page:5,fields:['parcel/khasra schedule begins']},{page:35,fields:['compensation summary total INR 1,117,572,745']}],
    officialCaseId: 'DL-BAMNOLI-AWARD-1-07-08', sourceReference: 'AWARD-1(07-08), Village Bamnoli',
    sourceAuthority: 'Land Acquisition Collector, District South West, Government of NCT of Delhi',
    sourceUrl: 'https://revenue.delhi.gov.in/land-acquisition/7227', sourceDocumentUrl: `${base}bamnoli-1_07-08.pdf`
  },
  {
    stateCode: 'DL', district: 'South West Delhi', projectName: 'Dwarka Phase II, Planned Development of Delhi',
    underAct: 'Land Acquisition Act, 1894',
    landExtentAsPublished: '2,904 Bigha 16 Biswas notified under Section 6; award document records field-book/notification discrepancies and says compensation for certain area awaits corrigendum',
    landExtentUnitAsPublished: 'Bigha-Biswa',
    parcelIdentifiers: ['40//21','41//25/2','52//1','24//22','23/1','24/1','25//2','8/2','9'],
    parcelIdentifierCoverage: 'SELECTED_CWP_STATUS_QUO_SCHEDULE_ENTRIES', acquisitionStage: 'AWARD_ISSUED',
    stageEvidenceReference: 'AWARD-26(02-03); award date 22-Oct-2002', stageEvidenceUrl: `${base}bharthal_26_02-03.pdf`, stageEvidenceDate: '2002-10-22',
    notificationDate: '2000-12-13', section4NotificationDate: '2000-12-13', section6NotificationDate: '2001-12-07', awardDate: '2002-10-22',
    compensationAmountInr: 1255465435.34, compensationStatus: 'AWARD_AMOUNT_PUBLISHED_PAYMENT_NOT_VERIFIED',
    possessionStatusNote: 'Award documents writ-petition-specific status-quo orders; it mentions a case in which physical possession of 3 Bigha had been taken before status quo. Overall possession is not treated as complete.',
    titleStatusNote: 'Status quo orders against dispossession and disputed claims are noted in the award; no general title/mutation status is inferred.',
    sourceDataQualityNotes: 'The notice area and field-book area differ in the source; the document calls for corrigendum for some khasra entries. Bigha-Biswa retained as published, no hectare conversion. Amount is award total, not verified payment.',
    sourceDocumentEvidence: [{page:8,fields:['Village Bharthal','Award 26(02-03)','Dwarka Phase-II','Section 4 notification date 13-Dec-2000','Section 6 notification date 07-Dec-2001']},{page:8,fields:['Notified area 2,904 Bigha 16 Biswas; discrepancy with field-book area']},{page:20,fields:['CWP-wise khasra identifiers and status quo status']},{page:40,fields:['Compensation summary total INR 1,255,465,435.34']},{page:41,fields:['Some possession had already been taken before one status-quo order']}],
    officialCaseId: 'DL-BHARTHAL-AWARD-26-02-03', sourceReference: 'AWARD-26(02-03), Village Bharthal',
    sourceAuthority: 'Land Acquisition Collector, District South-West, Government of NCT of Delhi',
    sourceUrl: 'https://revenue.delhi.gov.in/land-acquisition/7280', sourceDocumentUrl: `${base}bharthal_26_02-03.pdf`
  }
];
const result = service.importAcquisitionRecords(rows, { importedBy: 'research-ingestion' });
console.log(JSON.stringify({ inserted: result.inserted, duplicates: result.duplicates, recordKeys: result.records.map(r => r.recordKey) }, null, 2));
