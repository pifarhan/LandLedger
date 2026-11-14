CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','buyer','seller','authority','admin')),
  password_hash TEXT NOT NULL, identity_verification_status TEXT NOT NULL DEFAULT 'NOT_VERIFIED', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS properties (
  id BIGSERIAL PRIMARY KEY, parcel_number TEXT NOT NULL, title TEXT NOT NULL, address TEXT NOT NULL,
  area_sqm NUMERIC NOT NULL, land_type TEXT NOT NULL, owner_id BIGINT NOT NULL REFERENCES users(id),
  owner_name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  created_by BIGINT REFERENCES users(id), approved_by BIGINT REFERENCES users(id), rejection_reason TEXT,
  record_origin TEXT NOT NULL DEFAULT 'USER_SUBMITTED_UNVERIFIED', claimant_verification_status TEXT NOT NULL DEFAULT 'NOT_VERIFIED',
  state_code TEXT, state_name TEXT, district_name TEXT, district_source_lgd_code TEXT,
  sub_district_name TEXT, sub_district_source_lgd_code TEXT,
  admin_boundary_verification TEXT NOT NULL DEFAULT 'NOT_MATCHED', admin_boundary_source TEXT NOT NULL DEFAULT 'Survey of India ABDB',
  legal_title_status TEXT NOT NULL DEFAULT 'NOT_VERIFIED_BY_STATUTORY_REGISTRY', authority_review_scope TEXT NOT NULL DEFAULT 'WORKFLOW_REVIEW_ONLY',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), fraud_risk JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS properties_parcel_index ON properties(parcel_number);
CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY, property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL, mime_type TEXT NOT NULL, size BIGINT NOT NULL, sha256 TEXT NOT NULL,
  storage_key TEXT NOT NULL, uploaded_by BIGINT NOT NULL REFERENCES users(id), validation_status TEXT NOT NULL DEFAULT 'REVIEW', validation JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS documents_hash_index ON documents(sha256);
CREATE TABLE IF NOT EXISTS transfers (
  id BIGSERIAL PRIMARY KEY, property_id BIGINT NOT NULL REFERENCES properties(id), seller_id BIGINT NOT NULL REFERENCES users(id),
  buyer_id BIGINT NOT NULL REFERENCES users(id), notes TEXT, status TEXT NOT NULL DEFAULT 'PROPOSED'
  CHECK (status IN ('PROPOSED','ACCEPTED','FINALIZED','REJECTED')), authority_id BIGINT REFERENCES users(id),
  accepted_at TIMESTAMPTZ, finalized_at TIMESTAMPTZ, rejection_reason TEXT, fraud_risk JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ledger_events (
  id BIGSERIAL PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, action TEXT NOT NULL,
  actor_id BIGINT NOT NULL REFERENCES users(id), timestamp TIMESTAMPTZ NOT NULL, payload JSONB NOT NULL,
  payload_hash TEXT NOT NULL, previous_hash TEXT NOT NULL, block_hash TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS ledger_entity_index ON ledger_events(entity_type, entity_id, id);

ALTER TABLE documents ADD COLUMN IF NOT EXISTS validation_status TEXT NOT NULL DEFAULT 'REVIEW';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS validation JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE properties ADD COLUMN IF NOT EXISTS fraud_risk JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS fraud_risk JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE properties ADD COLUMN IF NOT EXISTS record_origin TEXT NOT NULL DEFAULT 'USER_SUBMITTED_UNVERIFIED';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS claimant_verification_status TEXT NOT NULL DEFAULT 'NOT_VERIFIED';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS legal_title_status TEXT NOT NULL DEFAULT 'NOT_VERIFIED_BY_STATUTORY_REGISTRY';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS authority_review_scope TEXT NOT NULL DEFAULT 'WORKFLOW_REVIEW_ONLY';

ALTER TABLE properties ADD COLUMN IF NOT EXISTS state_code TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS state_name TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS district_name TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS district_source_lgd_code TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS sub_district_name TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS sub_district_source_lgd_code TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS admin_boundary_verification TEXT NOT NULL DEFAULT 'NOT_MATCHED';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS admin_boundary_source TEXT NOT NULL DEFAULT 'Survey of India ABDB';
CREATE INDEX IF NOT EXISTS properties_parcel_scope_index ON properties(state_code, district_source_lgd_code, parcel_number);

ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_verification_status TEXT NOT NULL DEFAULT 'NOT_VERIFIED';
