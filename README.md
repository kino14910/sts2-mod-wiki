# sts2-mod-wiki

A SvelteKit wiki for Slay the Spire 2 mod content. Built with SvelteKit, Tailwind CSS, Paraglide (en/zh i18n), and deployed to Cloudflare Workers.

## Recreating this project

```sh
# recreate this project with the same configuration
pnpm dlx sv@1.1.1 create --template demo --types ts --add vitest="usages:unit,component" tailwindcss="plugins:typography,forms" playwright="demo:yes" enhanced-img sveltekit-adapter="adapter:cloudflare+cfTarget:workers" paraglide="languageTags:en, zh+demo:yes" ai-tools="ide:claude-code,other+delivery:plugin" --install pnpm sts2-mod-wiki
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

## Mod data

Configured mods are imported directly from DLL/PCK build artifacts:

```sh
pnpm mod:import --mod fgo --build "D:/Steam/steamapps/common/Slay the Spire 2/mods/Fgo"
```

See [docs/build-import.md](docs/build-import.md) for prerequisites, data boundaries, validation, incremental imports and snapshots. Generated mod data, parsed evidence, presentation configuration and community content are separate. The existing vanilla offline dataset remains under `static/mods/sts2`; imported mods no longer load manually maintained data from `static/mods/{modid}`.

See [docs/mod-manifest.md](docs/mod-manifest.md) for entity ID and localization conventions. Run `pnpm db:migrate:local` before testing community features locally.

See [the implementation review](docs/review-2026-11-13.md), [community collaboration](docs/wiki-collaboration.md), and [public entity identities](docs/public-entity-identity.md) for architecture, authentication, non-destructive history migration, and known data limitations. `pnpm data:audit-vanilla` compares the legacy vanilla catalog with the installed game without rewriting either input.

## Adding features

Add features to your project with `sv add`:

```sh
npx sv add
```
