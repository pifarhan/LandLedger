function groupBy(items, key) {
  return items.reduce((acc, item) => { const value = key(item); (acc[value] ||= []).push(item); return acc; }, {});
}

async function overview(store) {
  const [properties, documents, transfers, events, integrity] = await Promise.all([store.listProperties(), store.listDocuments(), store.listTransfers(), store.allEvents(), store.verifyLedger()]);
  const users = await store.listUsers();
  const parcelGroups = groupBy(properties, (property) => [
    String(property.stateCode || '').trim().toUpperCase(),
    String(property.districtSourceLgdCode || property.districtName || '').trim().toUpperCase(),
    String(property.parcelNumber || '').trim().toUpperCase()
  ].join('|'));
  const documentGroups = groupBy(documents, (document) => document.sha256);
  const duplicateParcels = Object.entries(parcelGroups).filter(([, items]) => items.length > 1).map(([, items]) => ({ parcelNumber: items[0].parcelNumber, stateName: items[0].stateName || null, districtName: items[0].districtName || null, propertyIds: items.map((item) => item.id), statuses: items.map((item) => item.status), ownerNames: [...new Set(items.map((item) => item.ownerName))] }));
  const conflictingOwnership = Object.values(parcelGroups)
    .map((items) => ({ parcelNumber: items[0].parcelNumber, stateName: items[0].stateName || null, districtName: items[0].districtName || null, items: items.filter((item) => item.status === 'APPROVED') }))
    .filter(({ items }) => new Set(items.map((item) => item.ownerId)).size > 1)
    .map(({ parcelNumber, stateName, districtName, items }) => ({ parcelNumber, stateName, districtName, propertyIds: items.map((item) => item.id), ownerNames: [...new Set(items.map((item) => item.ownerName))] }));
  const duplicateDocuments = Object.entries(documentGroups).filter(([, items]) => items.length > 1).map(([sha256, items]) => ({ sha256, documentIds: items.map((item) => item.id), propertyIds: [...new Set(items.map((item) => item.propertyId))] }));
  const byStatus = (items) => items.reduce((result, item) => { result[item.status] = (result[item.status] || 0) + 1; return result; }, {});
  const recentActivity = events.slice(-8).reverse();
  return {
    summary: { totalProperties: properties.length, approvedProperties: properties.filter((item) => item.status === 'APPROVED').length, pendingApprovals: properties.filter((item) => item.status === 'PENDING').length, totalUsers: users.length, documents: documents.length, transfers: transfers.length, finalizedTransfers: transfers.filter((item) => item.status === 'FINALIZED').length, ledgerBlocks: events.length },
    propertyStatus: byStatus(properties), transferStatus: byStatus(transfers),
    conflicts: { duplicateParcels, conflictingOwnership, duplicateDocuments, totalFlags: duplicateParcels.length + conflictingOwnership.length + duplicateDocuments.length },
    integrity, recentActivity
  };
}

module.exports = { overview };
