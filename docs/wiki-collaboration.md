# Wiki collaboration

## Content and page contracts

Game data, editorial source content and community revisions are separate inputs. Game data continues to supply statistics and localized entity names. `src/lib/data/card-article-content.ts` is the single Bash editorial source: the article view consumes its content, while `cardSectionSeeds()` serializes that same content to persisted Markdown. `card-wiki.ts` contains the article layout, entity presentation context and archived language names; it does not maintain another copy of the article facts.

`loadWikiPage(db, { type: 'card', id })` validates the game entity and initializes missing card sections. Unknown cards create no database rows. Initialization inserts missing pages, sections and first revisions in one batch and never replaces an existing revision, text, section ID or source binding. The canonical keys are `overview`, `obtaining`, `interactions`, `synergies`, `relics`, `notes`, `history`. Existing additional Markdown sections remain visible. Legacy structured documents and archived language content remain in the database; card articles consume Markdown sections.

`WikiSectionView` is the page/edit contract: `key`, `sectionId`, `contentType`, `content`, `version`, `revisionId`, provenance and sort order. Published empty content is intentional. A renderer must not replace it with fallback seed text. `WikiDocument` supports card documents in addition to validated legacy relic and power documents. Format validation applies before publication, including approval, rollback and source review.

The root server layout returns `viewer` containing a public session and server-derived permissions. Session subjects and provider secrets are never returned. Page loaders can return their own `viewer` with the same shape.

## Authentication

Production login is a site-owned QQ email + password flow. Configure these Vercel environment variables:

| Value | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (Neon or Supabase pooled endpoint) |
| `WIKI_SESSION_SECRET` | Strong random HMAC session key; keep secret |

Registration is open to any `@qq.com` address. `POST /api/auth/register` accepts `{ email, password, username }` and creates the account in one insert. Registration is rate-limited per IP hash via `auth_rate_limits`. `POST /api/auth/login` accepts `{ email, password }`. All endpoints reject any address whose domain is not exactly `@qq.com` with `EMAIL_DOMAIN_NOT_ALLOWED`. Passwords must be 8-128 characters and are stored as salted PBKDF2-SHA256 hashes in `users.password_hash`. Email is unique and checked again on every session resolution. New accounts are active ordinary `user` role (stored as legacy `member`); suspended users cannot sign in.

`GET /api/auth/session` returns the public session and effective permissions with `Cache-Control: no-store`. `DELETE /api/auth/session` clears the session cookie. Session cookies expire after seven days and contain only the signed subject and expiry. The server reloads role/status from Postgres on every request, so suspension and role changes apply on the next request. Stateless cookies do not provide individual token revocation after logout. Suspend the account or rotate the secret when revocation is required.

`POST /api/auth/session` is a development-only subject picker for elevated test roles. It requires `WIKI_DEV_LOGIN=1`, a session secret and a loopback hostname (`localhost`, `127.0.0.1`, `[::1]`). Its subject must also be an `@qq.com` address of an existing account; it cannot create accounts. The flag must remain disabled on public deployments. All cookie-authenticated mutation APIs reject an explicit foreign Origin.

Provision the first administrator explicitly in the `users` table, e.g. `UPDATE users SET role = 'admin' WHERE email = 'you@qq.com'`. No user becomes administrator merely because they registered first. `PUT /api/admin/users/:id/role` only accepts `user`, `trusted` and `moderator`; administrators assign these roles manually, and admin roles cannot be granted or revoked there. `GET /api/admin/users?q=…` lists users. Role/status management uses audited transactional writes and cannot remove the last active administrator.

## API and authorization

| Operation | Endpoint / body | Required authority |
| --- | --- | --- |
| Submit section edit | `POST /api/wiki/sections/:id/edits`, `{ content, baseVersion, summary? }` | User; trusted users publish directly |
| List users | `GET /api/admin/users?q=…` | Administrator |
| List proposals | `GET /api/wiki/proposals?sectionId=…&pageId=…&status=…&limit=…&offset=…` | Members see their own; reviewers see the queue |
| List section proposals | `GET /api/wiki/sections/:id/proposals` | Same visibility rule |
| Read proposal | `GET /api/wiki/proposals/:id` | Author or reviewer; anonymous access denied |
| Review proposal | `POST /api/wiki/proposals/:id`, `{ decision: 'approve' \| 'reject', note? }` | Moderator or administrator |
| Withdraw proposal | Same endpoint, `{ decision: 'withdraw' }` | Its author; pending/conflict only |
| Read revision history/diff | `GET /api/wiki/sections/:id/history`, optional `revision`, `limit`, `offset` | Public |
| Roll back | `POST /api/wiki/sections/:id/revert`, `{ revisionId, baseVersion, summary? }` | Moderator or administrator |
| Create Markdown section | `POST /api/wiki/pages/:id/sections`, `{ key, sortOrder? }` | Administrator |
| View sources/updates | `GET /api/admin/wiki/sources`, `/api/admin/wiki/source-updates`, `/api/admin/wiki/source-updates/:id` | Moderator or administrator |
| Review source update | `POST /api/admin/wiki/source-updates/:id`, `{ decision, baseVersion, note? }` | Administrator |
| Change role/status | `PUT /api/admin/users/:id/role` or `/status`, `{ role }` or `{ status }` | Administrator |
| Moderate comment | `PATCH /api/admin/comments/:id`, `{ status: 'visible' \| 'deleted', reason }` | Moderator or administrator |

Member edits return 202 with a proposal ID. Direct publication returns 200 with a revision ID and version. A rollback or source approval must send the `baseVersion` the reviewer actually saw; the backend must not silently substitute the latest version. A stale approval becomes a conflict; stale rollback/source publication returns 409. Rejection can close stale proposals without publishing anything. Conflict proposals retain their full draft and can be withdrawn and resubmitted against the current content.

## Transactions and history

Publishing inserts a revision only when the section version and parent still match. Proposal approval additionally checks that the proposal is pending and belongs to the same section/base. Source approval checks the open candidate, incoming/base hashes, active source and unchanged source baseline. Revision insertion, current-head update, proposal/source review, source snapshot and audit commit in one Postgres transaction. Publication success is determined from that transaction's row counts, not by querying whether the revision is still the head afterwards. Another valid publication must never turn a successful commit into an error or cause historical revision deletion.

Rollback is a new revision containing historical text. It does not remove or relink away historical rows. Proposal insertion/status transitions and audit records are transactional. Revision/source IDs remain stable across source-path migration.

## Editorial source synchronization

`scripts/mod-wiki/scan.mjs` prioritizes `content/wiki/{modid}/manifest.json` and its Markdown files. When no modern manifest exists for a mod, it reads the legacy `static/mods/{modid}/wiki/manifest.json`. Generated mod metadata comes from `generated/mods/{modid}/bundle.json` (`manifest.id` and `manifest.version`); legacy manifests are a fallback. A wiki-manifest version takes precedence when provided. Modern editorial content can be maintained independently of a game-data checkout.

The wiki manifest retains this structure:

```json
{
  "pages": [{
    "slug": "index",
    "sections": [{ "key": "overview", "file": "index/overview.md", "sortOrder": 0 }]
  }]
}
```

Files must remain inside their wiki root even after symlink resolution. Paths, section keys, slugs, content and versions are validated before writes. The exported synchronization boundary also normalizes every supplied entity reference and validates the whole input before writing any section, including calls that bypass the scanner. A raw reference is scoped using its explicit namespace or editorial Mod; conflicting explicit namespaces are rejected.

Run `pnpm mod-wiki:scan`, then `pnpm mod-wiki:sync -- --dry-run` to review the local plan, followed by `pnpm mod-wiki:sync` to apply it to the Postgres database named by `DATABASE_URL`. The script's exported `syncModWiki()` executes one transaction per section. It imports untouched baselines, creates review candidates when community and upstream both changed, and updates metadata when content already matches. Repeated open candidates are deduplicated by source/hash. Rejected content is not requeued against the same baseline; content that was only withdrawn can reappear with a new candidate ID.

The identity is `(mod, page slug, section key)`. Moving an article from the legacy directory into `content/wiki` preserves its `source_id`; `wiki_source_paths` records old and new paths. The active `source_path` changes, but old revision provenance and path records remain. A reused path cannot silently bind to another source. Only sections absent from a successfully scanned mod manifest are considered removed. An absent mod checkout is not treated as deletion. Removed upstream sections keep published content/history and their source row; unresolved candidates are withdrawn.

`--emit-sql <path>` exports conditional SQL for review/application to another database. Review the complete file and apply it as one transaction; it is not a blind replacement dump. `--emit-initial --emit-sql <path>` assumes an empty destination. A concurrent version mismatch preserves community changes and reports `RETRY`; rerun synchronization to classify the new state. Path reservations are retained as provenance even if an import loses a concurrent version race.

## Entity identity and retained archives

Internal game IDs stay raw. Public IDs come exclusively from `resolvePublicEntityRef()` and `publicEntityId()` in `src/lib/entity-identity.ts`: every non-vanilla entity uses `mod:rawId`; vanilla URLs remain bare unless another Mod owns the same entity type/raw ID. An ambiguous bare input never selects an owner by load order. For example, the actual catalogs contain both the vanilla 0-cost TeslaCoil and the Fgo 1-cost TeslaCoil, exposed separately as `sts2:TeslaCoil` and `fgo:TeslaCoil`.

Apply schema migrations `0006_entity_identity.sql` and `0007_identity_data_epoch.sql` before deploying this reader. The first collaboration request or page load reconciles the current catalog in one SQL transaction. This is a catalog-dependent data migration, separate from schema migration. `wiki_identity_mappings` records the first resolution, owner, candidates and catalog hash; subsequent catalog changes never overwrite that first ownership decision. A first-use record is also created before a newly initialized page or comment discussion can outlive its original catalog.

Migration 0007 tracks identity-bearing database writes with a persisted data epoch. Reconciliation skips work only when both the catalog hash and data epoch match the last completed transaction. The process-local cache shares only in-flight reconciliation; later writes are checked again even when the catalog and database handle have not changed. Late raw records from older importers therefore cannot bypass reconciliation by reusing an earlier catalog result.

A legacy page migrates only when its catalog owner is unique and consistent with its recorded `mod_id`, or a previous immutable unique mapping proves the same owner. The entity ID and entity slug can change; page, section, revision, source and proposal IDs stay unchanged. Anonymous comment IDs, tokens, replies and content/status history are retained when `target_id` changes. Bare comments without an ownership mapping or a corroborating historical page are quarantined; a currently unique catalog entry alone does not prove their historical owner. An old Fgo page cannot become another Mod's page merely because Fgo disappears and that other Mod is now the sole owner.

The originally ambiguous bare TeslaCoil page and discussion are quarantined even if a legacy `mod_id` happens to be present; that field alone cannot prove which conflicting content was previously edited. Their original rows and history remain intact. `wiki_identity_archives` and `wiki_comment_identity_archives` record the affected IDs, reasons and candidate evidence. Archived pages have `identity_status='archived'`, leave the active uniqueness indexes, and cannot publish new revisions. Existing section history endpoints can still read their revisions. The two live scoped pages initialize independently and never inherit that ambiguous article or discussion. A destination that already has its own history is also preserved independently; the displaced legacy page and its bare discussion are archived together instead of merging comments into the destination's discussion.

Public URLs and persistent community identities have different lifetimes. New card pages use a scoped storage identity even when the current vanilla URL is bare. Card discussions always use `mod:rawId`, independently of whether a Wiki page exists. Confirmed legacy bare comments migrate transactionally to that scoped target, including vanilla comments whose public URL remains bare. Creating the first page therefore does not switch discussion targets. Existing scoped pages are preferred for the same resolved namespace/raw ID, so removing Fgo does not hide the vanilla `sts2:TeslaCoil` history when its public URL becomes `TeslaCoil`. Reintroducing the collision selects those same page/section/revision IDs. Archived bare rows are excluded from that fallback. Existing unambiguous legacy vanilla pages may retain their bare storage ID until a scoped identity is required.

Moderators and administrators can inspect `GET /api/admin/wiki/identity-archives?limit=50&offset=0`. It returns archived page/comment IDs and first-resolution mappings without anonymous ownership tokens. `wiki_audit_logs` records `wiki.identity.map`, `wiki.identity.page` and `wiki.identity.first_use`. Archives are not automatically reassigned when a catalog shrinks or grows. Manual reattribution requires verified external ownership evidence and an explicit reviewed data migration; there is no bulk automatic restore endpoint. Keep the archive and mapping tables when backing up the database.

Mod editorial manifests also use this identity helper. An unprefixed entity reference defaults to the editorial Mod's namespace; `entity.id: 'sts2:Bash'` or an explicit `entity.modId` can reference another namespace. Conflicting explicit prefixes and `modId` values are rejected. Synchronizing canonical entity metadata preserves the source/page/section IDs and old source-path records. Archived source pages are skipped until their identity has been reviewed.

## Anonymous comments and migrations

Anonymous comments continue to use the browser's `x-comment-token`; login is not required and existing ownership hashes are preserved. Posting limits are checked again inside the insertion SQL, so concurrent requests cannot bypass the per-token/per-IP quotas. Comment edits compare the content and timestamp read at request start. Clients may additionally send the previously displayed `updatedAt` for protection against stale tabs. Without that field, sequential stale-tab edits cannot be distinguished; the request-time guard still prevents simultaneous lost updates. Comment revisions preserve prior text/status, and soft deletion leaves stored text/history intact. Moderator actions are audited and support restoring visible status.

Discussions are shown only at the bottom of card and relic pages, using `card` and `relic` targets respectively. `wiki_section` targets remain readable for existing data, but the UI no longer starts per-heading discussions. Migration `0012_relic_comment_target.sql` widens the target CHECK and keeps the previous comments, revisions and identity archives as recovery snapshots.

For new Postgres installations run `pnpm db:migrate`. It applies `postgres/schema.sql`, the final schema equivalent to the historical SQLite migrations, plus the one-time wiki seed from `0002_seed_wiki.sql`. The `migrations/*.sql` files remain as historical SQLite records; do not apply them to Postgres. The final schema includes source-path history, incoming mod versions, comment revision history, single-use OAuth states, identity catalogs and relic comment targets.

An installation which already applied the original destructive 0003 cannot reconstruct previously deleted comments from later migrations. Restore those rows from a verified backup if available. Do not drop the legacy archive tables until their contents have been independently reviewed and backed up. Schema migrations are not run by page requests or tests against a user's database. After the schema has been applied, catalog reconciliation can update identity metadata transactionally on the first relevant request.

## Verification and limitations

`pnpm exec vitest run --config vitest.collaboration.config.ts` runs backend tests without requiring generated game bundles or a UI build. Business-logic tests execute production SQL in in-memory SQLite with foreign keys and transactional batches, including migrations with pre-existing comments/replies, approval/rejection races, publication immediately after commit, source-baseline changes, stale rollback, idempotent card initialization, path moves, repeated upstream hashes, concurrent anonymous rate limits and OAuth state replay. Translation tests cover the adapter compatibility layer. API authorization tests verify visibility separately from the UI.

The SQLite adapter verifies business semantics but not Postgres dialect correctness. E2E requires an isolated `TEST_DATABASE_URL`; a production build and that database are additional integration checks. Editorial seed updates never silently overwrite community revisions already in Postgres; source changes require the explicit synchronization/review path.
