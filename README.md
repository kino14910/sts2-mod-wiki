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
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

Create a production version of the app:

```sh
npm run build
```

Preview the production build with `npm run preview`.

## Adding features

Add features to your project with `sv add`:

```sh
npx sv add
```
