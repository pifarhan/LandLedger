const fs = require('fs');
const path = require('path');

const gatewayCache = new Map();

function env(name, fallback = '') { return process.env[name] || fallback; }

function requiredValue(name) {
  const value = env(name);
  if (!value) throw new Error(`${name} is required when FABRIC_MODE=fabric`);
  return value;
}
function requiredPath(name) {
  const value = requiredValue(name);
  if (!fs.existsSync(value)) throw new Error(`${name} does not exist: ${value}`);
  return value;
}

async function connectFabric(clientRole = 'application') {
  if (!['application', 'authority'].includes(clientRole)) throw new Error(`Unsupported Fabric client role: ${clientRole}`);
  if (gatewayCache.has(clientRole)) return gatewayCache.get(clientRole);

  const promise = (async () => {
    let fabricGateway;
    let grpc;
    try {
      fabricGateway = require('@hyperledger/fabric-gateway');
      grpc = require('@grpc/grpc-js');
    } catch {
      throw new Error('Fabric Gateway dependencies are not installed. Run npm install in server/.');
    }

    const authority = clientRole === 'authority';
    const certEnv = authority ? 'FABRIC_AUTHORITY_IDENTITY_CERT' : 'FABRIC_IDENTITY_CERT';
    const keyEnv = authority ? 'FABRIC_AUTHORITY_IDENTITY_KEY_DIR' : 'FABRIC_IDENTITY_KEY_DIR';
    const certPath = requiredPath(certEnv);
    const keyDir = requiredPath(keyEnv);
    const tlsCertPath = requiredPath('FABRIC_TLS_CERT');
    const endpoint = env('FABRIC_PEER_ENDPOINT', 'localhost:7051');
    const channelName = env('FABRIC_CHANNEL', 'landchannel');
    const chaincodeName = env('FABRIC_CHAINCODE', 'landrecords');
    const mspId = env(authority ? 'FABRIC_AUTHORITY_MSP_ID' : 'FABRIC_MSP_ID', authority ? env('FABRIC_MSP_ID', 'Org1MSP') : 'Org1MSP');
    const tlsServerName = env('FABRIC_TLS_SERVER_NAME', 'peer0.org1.example.com');
    const keyFile = fs.readdirSync(keyDir).find((name) => name.endsWith('_sk') || name.endsWith('.pem'));
    if (!keyFile) throw new Error(`No private key found in ${keyDir}`);

    const client = new grpc.Client(endpoint, grpc.credentials.createSsl(fs.readFileSync(tlsCertPath)), {
      'grpc.ssl_target_name_override': tlsServerName,
      'grpc.default_authority': tlsServerName
    });
    const identity = { mspId, credentials: fs.readFileSync(certPath) };
    const signer = fabricGateway.signers.newPrivateKeySigner(
      require('crypto').createPrivateKey(fs.readFileSync(path.join(keyDir, keyFile)))
    );
    const gateway = fabricGateway.connect({
      identity, signer, client,
      evaluateOptions: () => ({ deadline: Date.now() + 5000 }),
      endorseOptions: () => ({ deadline: Date.now() + 15000 }),
      submitOptions: () => ({ deadline: Date.now() + 15000 }),
      commitStatusOptions: () => ({ deadline: Date.now() + 15000 })
    });
    const network = gateway.getNetwork(channelName);
    const contract = network.getContract(chaincodeName);
    return { gateway, network, contract, client, channelName, chaincodeName, mspId, endpoint, clientRole };
  })();

  gatewayCache.set(clientRole, promise);
  try {
    return await promise;
  } catch (error) {
    gatewayCache.delete(clientRole);
    throw error;
  }
}

async function submit(transaction, args = [], clientRole = 'application') {
  const { contract } = await connectFabric(clientRole);
  const tx = await contract.submitTransaction(transaction, ...args.map((value) => String(value ?? '')));
  const text = Buffer.from(tx).toString('utf8');
  return text ? JSON.parse(text) : null;
}

async function evaluate(transaction, args = [], clientRole = 'application') {
  const { contract } = await connectFabric(clientRole);
  const result = await contract.evaluateTransaction(transaction, ...args.map((value) => String(value ?? '')));
  const text = Buffer.from(result).toString('utf8');
  return text ? JSON.parse(text) : null;
}

async function status() {
  const application = await connectFabric('application');
  let authorityConfigured = false;
  try {
    await connectFabric('authority');
    authorityConfigured = true;
  } catch (error) {
    return {
      mode: 'fabric', connected: true, applicationIdentityConnected: true,
      authorityIdentityConnected: false, authorityError: error.message,
      endpoint: application.endpoint, channel: application.channelName,
      chaincode: application.chaincodeName, mspId: application.mspId,
      note: 'Application identity is connected; authority review transactions require separate authority credentials.'
    };
  }
  return {
    mode: 'fabric', connected: true, applicationIdentityConnected: true,
    authorityIdentityConnected: authorityConfigured, endpoint: application.endpoint,
    channel: application.channelName, chaincode: application.chaincodeName,
    mspId: application.mspId
  };
}

async function close() {
  for (const pending of gatewayCache.values()) {
    try { const connection = await pending; connection.gateway.close(); connection.client.close(); } catch {}
  }
  gatewayCache.clear();
}

module.exports = { submit, evaluate, status, close, connectFabric };
