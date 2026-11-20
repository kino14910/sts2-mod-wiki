const ITERATIONS = 210_000
const KEY_LENGTH = 32
const encoder = new TextEncoder()

function base64(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function fromBase64(value: string): Uint8Array {
	const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
	return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const result = new ArrayBuffer(bytes.byteLength)
	new Uint8Array(result).set(bytes)
	return result
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey('raw', arrayBuffer(encoder.encode(password)), 'PBKDF2', false, ['deriveBits'])
	return new Uint8Array(await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt: arrayBuffer(salt), iterations, hash: 'SHA-256' }, key, KEY_LENGTH * 8
	))
}

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16))
	return `pbkdf2$${ITERATIONS}$${base64(salt)}$${base64(await derive(password, salt, ITERATIONS))}`
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
	if (!stored) return false
	const [scheme, rawIterations, rawSalt, rawHash] = stored.split('$')
	if (scheme !== 'pbkdf2' || !rawIterations || !rawSalt || !rawHash) return false
	const iterations = Number(rawIterations)
	if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > 1_000_000) return false
	let salt: Uint8Array
	let expected: Uint8Array
	try {
		salt = fromBase64(rawSalt)
		expected = fromBase64(rawHash)
	} catch { return false }
	if (expected.length !== KEY_LENGTH) return false
	const actual = await derive(password, salt, iterations)
	let difference = 0
	for (let i = 0; i < expected.length; i++) difference |= actual[i] ^ expected[i]
	return difference === 0
}
