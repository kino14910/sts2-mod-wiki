import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'node scripts/e2e-setup.mjs && pnpm build && pnpm exec wrangler dev .svelte-kit/cloudflare/_worker.js --port 4173 --persist-to .cache/e2e-state --var WIKI_DEV_LOGIN:1 --var WIKI_SESSION_SECRET:test-only-e2e-secret-do-not-use-in-production',
		port: 4173,
		timeout: 240_000,
		reuseExistingServer: false
	},
	use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
	workers: 1,
	testMatch: '**/*.e2e.{ts,js}'
});
