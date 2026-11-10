declare global {
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
