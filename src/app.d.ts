declare global {
	type WikiDatabase = import('#lib/server/db/types').WikiDatabase
	type WikiStatement = import('#lib/server/db/types').WikiStatement
	type WikiResult<T = unknown> = import('#lib/server/db/types').WikiResult<T>

	namespace App {
		interface Locals {
			wikiDb: WikiDatabase | null
			session: import('#lib/server/auth/session').AuthSession | null
		}
	}
}

export {}
