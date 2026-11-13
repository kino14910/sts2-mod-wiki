declare global {
	// Optional bindings for wiki collaboration. Generated worker-configuration.d.ts declares
	// DB/ASSETS; these two secrets are read only when present.
	interface Env {
		/** HMAC key for signed wiki session cookies. Without it no session is trusted. */
		WIKI_SESSION_SECRET?: string;
		/** Set to '1' to enable the local development subject picker. Never enable in production. */
		WIKI_DEV_LOGIN?: string;
		WIKI_PUBLIC_ORIGIN?: string;
		GITHUB_CLIENT_ID?: string;
		GITHUB_CLIENT_SECRET?: string;
	}

	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties
		}

		interface Locals {
			wikiDb: D1Database | null;
			session: import('#lib/server/auth/session').AuthSession | null;
		}
	}
}

export {};
