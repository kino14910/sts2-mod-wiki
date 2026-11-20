-- Community login identities are restricted to verified QQ email addresses.
-- Existing accounts keep their role/status; the nullable column is backfilled on next sign-in.
ALTER TABLE users ADD COLUMN email TEXT;
