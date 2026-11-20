const encoder = new TextEncoder()

export function base64Url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export function constantTimeEquals(left: string, right: string): boolean {
	if (left.length !== right.length) return false
	let difference = 0
	for (let i = 0; i < left.length; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i)
	return difference === 0
}

export async function hmacBase64Url(secret: string, value: string): Promise<string> {
	const key = await crypto.subtle.importKey('raw', encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
	return base64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))))
}

export async function sha256Hex(value: string): Promise<string> {
	const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}
