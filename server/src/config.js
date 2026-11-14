const path = require('path');

function config(overrides = {}) {
  const production = (overrides.nodeEnv || process.env.NODE_ENV) === 'production';
  const suppliedSecret = overrides.jwtSecret || process.env.JWT_SECRET || '';
  if (production && suppliedSecret.length < 32) {
    throw new Error('Production requires a JWT_SECRET of at least 32 characters. The development fallback is not permitted.');
  }
  return {
    port: Number(overrides.port || process.env.PORT || 5000),
    jwtSecret: suppliedSecret || 'local-development-only-not-for-production',
    databaseMode: overrides.databaseMode || process.env.DATABASE_MODE || 'mock',
    postgresUrl: overrides.postgresUrl || process.env.POSTGRES_URL || '',
    dataFile: overrides.dataFile || path.resolve(__dirname, '../data/ledger.json'),
    uploadDir: overrides.uploadDir || process.env.UPLOAD_DIR || path.resolve(__dirname, '../uploads'),
    fabricMode: overrides.fabricMode || process.env.FABRIC_MODE || 'mock',
    corsOrigins: overrides.corsOrigins || (process.env.CORS_ORIGIN || '').split(',').map((value) => value.trim()).filter(Boolean)
  };
}

module.exports = { config };
