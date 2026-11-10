import { env } from 'cloudflare:workers'

// adapter-cloudflare 8 exposes bindings through cloudflare:workers in Workers; platform.env only exists in the dev emulator.
export function getPlatformEnv(platform?: Readonly<App.Platform>): Env | undefined {
	if (platform?.env) return platform.env
	try {
		void env.DB
		return env
	} catch {
		return undefined
	}
}

export function getWikiDb(platform?: Readonly<App.Platform>): D1Database | null {
	return getPlatformEnv(platform)?.DB ?? null
}
