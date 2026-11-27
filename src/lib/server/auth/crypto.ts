const encoder = new TextEncoder()

export async function sha256Hex(value: string): Promise<string> {
	const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}
