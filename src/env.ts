import { defineEnvVars } from '@sveltejs/kit/env'

export const variables = defineEnvVars({
	DATABASE_URL: {
		description: 'Postgres connection string (Neon pooled endpoint preferred)',
		schema: (value) => value ?? ''
	},
	WIKI_SESSION_SECRET: {
		description: 'HMAC key for signed session cookies',
		schema: (value) => value ?? ''
	},
	WIKI_DEV_LOGIN: {
		description: 'Set to 1 only for local development subject picker',
		schema: (value) => value ?? ''
	}
})
