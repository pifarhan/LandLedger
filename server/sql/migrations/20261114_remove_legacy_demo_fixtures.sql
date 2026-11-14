-- Run only after taking a verified PostgreSQL backup and reviewing the target rows.
-- This migration removes only the exact legacy LandLedger fixture accounts and rows.
-- It does not attempt to classify or delete unrelated user data.
BEGIN;

CREATE TEMP TABLE landledger_fixture_users ON COMMIT DROP AS
SELECT id
FROM users
WHERE lower(email) IN (
  'authority@landledger.demo',
  'ananya.owner@landledger.demo',
  'rohan.buyer@landledger.demo',
  'meera.seller@landledger.demo'
);

CREATE TEMP TABLE landledger_fixture_properties ON COMMIT DROP AS
SELECT id
FROM properties
WHERE owner_id IN (SELECT id FROM landledger_fixture_users)
   OR (parcel_number IN ('KA-BLR-1108', 'KA-BLR-2217')
       AND lower(owner_name) IN ('ananya sharma', 'meera iyer'));

CREATE TEMP TABLE landledger_fixture_transfers ON COMMIT DROP AS
SELECT id
FROM transfers
WHERE property_id IN (SELECT id FROM landledger_fixture_properties)
   OR seller_id IN (SELECT id FROM landledger_fixture_users)
   OR buyer_id IN (SELECT id FROM landledger_fixture_users);

-- Remove chain rows linked to fixture entities or authored by fixture accounts.
DELETE FROM ledger_events
WHERE actor_id IN (SELECT id FROM landledger_fixture_users)
   OR (entity_type = 'PROPERTY' AND entity_id IN (SELECT id::text FROM landledger_fixture_properties))
   OR (entity_type = 'TRANSFER' AND entity_id IN (SELECT id::text FROM landledger_fixture_transfers));

DELETE FROM documents
WHERE property_id IN (SELECT id FROM landledger_fixture_properties)
   OR uploaded_by IN (SELECT id FROM landledger_fixture_users);

DELETE FROM transfers
WHERE id IN (SELECT id FROM landledger_fixture_transfers);

UPDATE transfers
SET authority_id = NULL
WHERE authority_id IN (SELECT id FROM landledger_fixture_users)
  AND id NOT IN (SELECT id FROM landledger_fixture_transfers);

-- Preserve unrelated properties created/reviewed by a fixture authority, while removing
-- their obsolete fixture foreign-key references.
UPDATE properties
SET created_by = NULL
WHERE created_by IN (SELECT id FROM landledger_fixture_users)
  AND id NOT IN (SELECT id FROM landledger_fixture_properties);

UPDATE properties
SET approved_by = NULL
WHERE approved_by IN (SELECT id FROM landledger_fixture_users)
  AND id NOT IN (SELECT id FROM landledger_fixture_properties);

DELETE FROM properties
WHERE id IN (SELECT id FROM landledger_fixture_properties);

DELETE FROM users
WHERE id IN (SELECT id FROM landledger_fixture_users);

COMMIT;
