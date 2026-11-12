// Signed, stateless session cookies. The cookie only carries an auth subject; the role is
// always read from D1, so a client can never promote itself by editing the token.
export const SESSION_COOKIE = 'sts2_wiki_session'
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7

export interface SessionPayload {
	sub: string
	exp: number
}

const encoder = new TextEncoder()

function base64Url(bytes: Uint8Array): string {
	let binary = ''
	for (const byte of bytes) binary += String.fromCharCode(byte)
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function fromBase64Url(value: string): Uint8Array {
	const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/'))
	return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	)
	return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data)))
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false
	let diff = 0
	for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index)
	return diff === 0
}

export async function signSession(
	subject: string,
	secret: string,
	now = Date.now(),
	ttlSeconds = SESSION_TTL_SECONDS
): Promise<string> {
	const payload = base64Url(encoder.encode(JSON.stringify({ sub: subject, exp: now + ttlSeconds * 1000 })))
	const signature = base64Url(await hmac(secret, payload))
	return `${payload}.${signature}`
}

export async function verifySession(
	token: string | null | undefined,
	secret: string,
	now = Date.now()
): Promise<SessionPayload | null> {
	if (!token || !secret) return null
	const separator = token.indexOf('.')
	if (separator <= 0 || separator === token.length - 1) return null
	const payload = token.slice(0, separator)
	const signature = token.slice(separator + 1)
	const expected = base64Url(await hmac(secret, payload))
	if (!timingSafeEqual(signature, expected)) return null
	try {
		const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as SessionPayload
		if (typeof parsed.sub !== 'string' || !parsed.sub) return null
		if (typeof parsed.exp !== 'number' || !Number.isFinite(parsed.exp) || parsed.exp <= now) return null
		return parsed
	} catch {
		return null
	}
}

export function readSessionCookie(request: Request): string | null {
	const header = request.headers.get('cookie')
	if (!header) return null
	for (const part of header.split(';')) {
		const separator = part.indexOf('=')
		if (separator < 0) continue
		if (part.slice(0, separator).trim() === SESSION_COOKIE)
			return decodeURIComponent(part.slice(separator + 1).trim())
	}
	return null
}

export function sessionCookie(value: string): string {
	return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`
}

export function clearSessionCookie(): string {
	return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}
