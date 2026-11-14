require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { config } = require('./config');
const { createStore } = require('./store');
const { seedStore } = require('./seed');
const { createApp } = require('./app');

(async () => {
  const options = config();
  const store = await createStore(options);
  await seedStore(store); // Only creates an authority account when explicitly provisioned through BOOTSTRAP_AUTHORITY_*; never seeds owners or properties.
  const app = createApp({ store, options });
  app.listen(options.port, () => console.log(`Land Ledger API listening on http://localhost:${options.port} (${options.databaseMode} mode)`));
})().catch((error) => { console.error('Unable to start API:', error); process.exit(1); });
