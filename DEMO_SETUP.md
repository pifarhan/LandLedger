# LandLedger — local development setup without fabricated records

## One-time setup

```bash
cp .env.example .env
```

Set a `JWT_SECRET` of at least 32 random characters. Install the packages:

```bash
npm install
npm install --prefix server
npm install --prefix client
```

Start the app:

```bash
npm run dev
```

Open `http://localhost:5173`.

## Accounts

There are **no demo logins**. The default ledger starts empty. Use the registration form to create an owner, buyer or seller account. Public registration cannot create an authority or administrator.

An authority account may be provisioned only by the system operator through `BOOTSTRAP_AUTHORITY_NAME`, `BOOTSTRAP_AUTHORITY_EMAIL` and a strong `BOOTSTRAP_AUTHORITY_PASSWORD` in the server environment. Do not commit these values.

## Property data

There are no sample owners or properties. Each property record is a user-submitted claim. The State/District selectors use the included Survey of India administrative index. If the selected local unit is missing, the record is explicitly marked for manual review.

No government parcel ownership is invented or copied from unrelated data. Use a government-approved/consent-based API or file exchange to import any person-level data.

## Research / Fabric mode

Local development defaults to `FABRIC_MODE=mock`. After deploying a real Fabric network, configure the gateway credentials and set `FABRIC_MODE=fabric`. Do not report live Fabric TPS/latency until the benchmark is run against the deployed network.
