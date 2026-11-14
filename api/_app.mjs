import { createRequire } from 'module';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const { createApp } = require('../server/src/app');
const { createStore } = require('../server/src/store');

let appPromise;

export async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const temporaryRoot = path.join(os.tmpdir(), 'landledger-prototype');
      const options = {
        port: 0,
        databaseMode: 'mock',
        dataFile: path.join(temporaryRoot, 'ledger.json'),
        uploadDir: path.join(temporaryRoot, 'uploads'),
        jwtSecret: process.env.JWT_SECRET || '',
        corsOrigins: (process.env.CORS_ORIGIN || '').split(',').map((value) => value.trim()).filter(Boolean),
        fabricMode: process.env.FABRIC_MODE || 'mock'
      };
      if (options.jwtSecret.length < 32) throw new Error('Set a 32+ character JWT_SECRET in Vercel environment variables.');
      const store = await createStore(options);
      return createApp({ store, options });
    })();
  }
  return appPromise;
}
