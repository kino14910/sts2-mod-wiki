-- Signed-in comments keep their author account so the UI can show the account avatar.
-- Anonymous comments keep a NULL author_user_id and fall back to the initial-letter avatar.
ALTER TABLE comments ADD COLUMN author_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE comments ADD COLUMN author_avatar_url TEXT;
CREATE INDEX IF NOT EXISTS idx_comments_author_user_created ON comments(author_user_id, created_at DESC);
