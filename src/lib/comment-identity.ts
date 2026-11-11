// Anonymous comment identity: a browser-local secret token proves ownership, the display name is public.

const TOKEN_KEY = 'sts2.wiki.comment.token'
const NAME_KEY = 'sts2.wiki.comment.name'

function storage(): Storage | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage
	} catch {
		return null
	}
}

// crypto.randomUUID needs a secure context, so plain-HTTP origins fall back to random bytes.
function randomToken(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID()
	}
	const bytes = new Uint8Array(16)
	if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
		crypto.getRandomValues(bytes)
	} else {
		for (let index = 0; index < bytes.length; index += 1) {
			bytes[index] = Math.floor(Math.random() * 256)
		}
	}
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

// Kept in memory when storage is blocked so the session can still post comments.
let sessionToken = ''

export function getCommentToken(): string {
	const store = storage()
	if (!store) {
		sessionToken ||= randomToken()
		return sessionToken
	}
	const existing = store.getItem(TOKEN_KEY)
	if (existing) return existing
	const token = randomToken()
	try {
		store.setItem(TOKEN_KEY, token)
	} catch {
		sessionToken = token
	}
	return token
}

export function getCommentName(): string {
	return storage()?.getItem(NAME_KEY) ?? ''
}

export function setCommentName(name: string): void {
	try {
		storage()?.setItem(NAME_KEY, name.trim())
	} catch {
		// Storage can be blocked; the name is only a convenience default.
	}
}

export function commentRequestHeaders(): Record<string, string> {
	return { 'x-comment-token': getCommentToken() }
}
