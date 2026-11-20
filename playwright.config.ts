import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'node scripts/e2e-setup.mjs && pnpm build && DATABASE_URL=$TEST_DATABASE_URL WIKI_DEV_LOGIN=1 WIKI_SESSION_SECRET=test-only-e2e-secret-do-not-use-in-production pnpm preview -- --port 4173',
		port: 4173,
		timeout: 240_000,
		reuseExistingServer: false
	},
	use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
	workers: 1,
	testMatch: '**/*.e2e.{ts,js}'
});
