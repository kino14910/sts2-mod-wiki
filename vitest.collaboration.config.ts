import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Backend tests need neither the UI build nor generated game bundles.
export default defineConfig({
	resolve: { alias: { '#lib': fileURLToPath(new URL('./src/lib', import.meta.url)) } },
	test: { environment: 'node', include: ['src/lib/server/**/*.spec.ts', 'src/lib/wiki-document.spec.ts'],
		expect: { requireAssertions: true } }
})
