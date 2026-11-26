# sts2-mod-wiki

A SvelteKit wiki for Slay the Spire 2 mod content. Built with SvelteKit, Tailwind CSS, Paraglide (en/zh i18n), and deployed to Vercel with Postgres.

## Recreating this project

```sh
# recreate this project with the same configuration
pnpm dlx sv@1.1.1 create --template demo --types ts --add vitest="usages:unit,component" tailwindcss="plugins:typography,forms" playwright="demo:yes" enhanced-img sveltekit-adapter="adapter:vercel" paraglide="languageTags:en, zh+demo:yes" ai-tools="ide:claude-code,other+delivery:plugin" --install pnpm sts2-mod-wiki
```

## Developing

Start a development server:

```sh
pnpm dev

# or start the server and open the app in a new browser tab
pnpm dev --open
```

## Building

Create a production version of the app:

```sh
pnpm build
```

Preview the production build with `pnpm preview`.

## Database and environment

Copy `.env.example` to `.env`, set `DATABASE_URL` (Neon pooled connection string; Supabase also works) and `WIKI_SESSION_SECRET`, then apply the Postgres schema:

```sh
pnpm db:migrate
```

`db:migrate` prefers `DATABASE_URL_UNPOOLED` for schema changes and falls back to `DATABASE_URL`. On Vercel, set `DATABASE_URL` and `WIKI_SESSION_SECRET`; `DATABASE_URL_UNPOOLED` is only needed for local/CI migrations.

Vercel uses `@sveltejs/adapter-vercel` with the Node.js 22 runtime. Set the same variables in the Vercel project and redeploy:

```sh
vercel env add DATABASE_URL production
vercel env add WIKI_SESSION_SECRET production
```

`WIKI_DEV_LOGIN` stays unset in production. E2E uses `TEST_DATABASE_URL` and requires `WIKI_DEV_LOGIN=1` locally only.

## Mod data

Configured mods are imported directly from DLL/PCK build artifacts:

```sh
pnpm mod:import --mod fgo --build "D:/Steam/steamapps/common/Slay the Spire 2/mods/Fgo"
```

See [docs/build-import.md](docs/build-import.md) for prerequisites, data boundaries, validation, incremental imports and snapshots. Generated mod data, parsed evidence, presentation configuration and community content are separate. The full vanilla offline dataset is committed under `static/mods/sts2` because the build reads its manifest and serves its icons from there; imported mods no longer load manually maintained data from `static/mods/{modid}`.

The active normalized bundle (`generated/mods/fgo/bundle.json`) and its fixed asset directory (`static/imported/fgo/images/`) are committed so Vercel can build without the source DLL/PCK. Vanilla and imported mod images are committed as WebP. After re-importing, run `python scripts/convert_mod_images_to_webp.py --quality 90`; PNG sources are moved out of the repository, mod references pointing at converted icons are rewritten, and the next import removes images that are no longer referenced. The converter is idempotent, so re-running it also repairs references left behind by an earlier conversion. Asset paths are stable, so roll back by reverting the bundle and image commit.

See [docs/mod-manifest.md](docs/mod-manifest.md) for entity ID and localization conventions. Run `pnpm db:migrate` before testing community features locally.

See [the implementation review](docs/review-2026-11-13.md), [community collaboration](docs/wiki-collaboration.md), and [public entity identities](docs/public-entity-identity.md) for architecture, authentication, non-destructive history migration, and known data limitations. `pnpm data:audit-vanilla` compares the legacy vanilla catalog with the installed game without rewriting either input.

## Adding features

Add features to your project with `sv add`:

```sh
npx sv add
```
