-- One-time codes prove ownership of the registering @qq.com address.
-- Only HMAC digests are stored; codes are never persisted in plaintext.
CREATE TABLE IF NOT EXISTS auth_email_codes (
	id TEXT PRIMARY KEY,
	email TEXT NOT NULL,
	code_hash TEXT NOT NULL,
	expires_at INTEGER NOT NULL,
	attempts INTEGER NOT NULL DEFAULT 0,
	consumed_at INTEGER,
	created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_email_codes_email_created ON auth_email_codes(email, created_at DESC);
