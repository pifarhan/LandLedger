# Federated owner and parcel integrations (v17)

## Connector comparison

| Provider | Kind | Documented coverage | Lookup pattern | Access |
|---|---|---|---|---|
| RBIH ULI Next-Gen LRS | RBIH-backed federated service to State government systems | 12 State backends | Asynchronous single parcel query + poll | Institutional onboarding, IP whitelist, subscribed client ID/JWT and consent |
| RBIH LRS v3 guide | Separate lender integration interface | 14 States in guide | State-specific master-data and ownership calls | Institutional integration; `consent-id` required |
| India Property Register | Independent commercial aggregation API | Provider documentation claims plot records loaded for 28/36 States/UTs; live per-State coverage must be checked | State LGD coverage → village LGD + plot identifier → provider `ipr_id` → one plot detail | Provider API key and paid wallet calls |
| State/UT citizen/authority portals | Primary government source systems | 36 directory entries, availability varies | State-specific search, ROR request, or issuing-office access | State rules, account, OTP, fees or authority access as applicable |

## Backend routes

- `GET /api/federated-land-records/status`
- `POST /api/federated-land-records/query` — authority/admin only
- `GET /api/federated-land-records/requests/:requestId` — authority/admin only
- `GET /api/third-party-land-records/status`
- `GET /api/third-party-land-records/places?q=...` — authority/admin only
- `GET /api/third-party-land-records/coverage?stateLgd=...` — authority/admin only; checks provider-reported coverage for one State LGD
- `GET /api/third-party-land-records/plots?villageLgd=...&plot=...` — authority/admin only
- `GET /api/third-party-land-records/plots/:iprId` — authority/admin only
- `GET /api/government-data/parcels?limit=100&offset=0` — owner names only for authority/admin
- `POST /api/parcel-evidence/import` — authority/admin only
- `POST /api/parcel-evidence/:recordKey/verify` — authority/admin only; multipart field `sourceDocument` is required

## Data handling

- No external provider API result is stored by the third-party connector.
- API keys are server environment variables, never exposed to the React client.
- Audit events retain only request/query hashes, status and provider ID, not returned holder names.
- The local parcel evidence store is blank in the release and remains blank until a lawful source-backed import.
- Imported holder names are restricted to authority/admin; ordinary users only see a restricted marker.
- Source record verification does not create a legal title status.
- IPR data must not be bulk exported, redistributed or used to train/evaluate models without the provider's separate written licence. Its headline parcel-scale claim is not independently established; one documentation stats example conflicts with the marketing claim, so always check the live state coverage endpoint and exact plot response.

## Billing

IPR's public docs list ₹0.40 per successful call. Place search is one call. A plot lookup typically calls (1) village/plot match and (2) full detail endpoint. Each lookup can therefore consume provider wallet credit. The application does not automatically loop, enumerate a village, or download pages.
