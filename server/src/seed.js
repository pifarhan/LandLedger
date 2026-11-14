require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const { config } = require('./config');
const { createStore } = require('./store');

/**
 * No fictional people or parcels are seeded.
 * An authority account is created only when all three BOOTSTRAP_AUTHORITY_*
 * environment variables are supplied by the deploying organisation.
 */
async function bootstrapAuthority(store, env = process.env) {
  const name = String(env.BOOTSTRAP_AUTHORITY_NAME || '').trim();
  const email = String(env.BOOTSTRAP_AUTHORITY_EMAIL || '').trim().toLowerCase();
  const password = String(env.BOOTSTRAP_AUTHORITY_PASSWORD || '');
  if (!name && !email && !password) return { created: false, reason: 'no_bootstrap_credentials_configured' };
  if (!name || !email || password.length < 16) {
    throw new Error('Set BOOTSTRAP_AUTHORITY_NAME, BOOTSTRAP_AUTHORITY_EMAIL and a BOOTSTRAP_AUTHORITY_PASSWORD of at least 16 characters.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('BOOTSTRAP_AUTHORITY_EMAIL is invalid.');
  const existing = await store.findUserByEmail(email);
  if (existing) {
    if (!['authority', 'admin'].includes(existing.role)) throw new Error('The bootstrap email already belongs to a non-authority account; refusing role escalation.');
    return { created: false, reason: 'authority_account_already_exists', email };
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await store.createUser({ name, email, role: 'authority', passwordHash, identityVerificationStatus: 'ADMIN_PROVISIONED' });
  return { created: true, email: user.email, role: user.role };
}

async function seed() {
  const options = config();
  const store = await createStore(options);
  if (options.databaseMode === 'mock' && process.argv.includes('--reset')) {
    if (typeof store.reset !== 'function') throw new Error('Reset is available only in mock database mode.');
    store.reset();
  }
  const result = await bootstrapAuthority(store);
  console.log(result.created
    ? `Authority account provisioned from environment: ${result.email}`
    : 'No demo accounts or sample properties created. Configure BOOTSTRAP_AUTHORITY_* only when provisioning an authorised authority account.');
  if (store.close) await store.close();
  return result;
}

if (require.main === module) {
  seed().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}

module.exports = { seedStore: bootstrapAuthority, bootstrapAuthority };
