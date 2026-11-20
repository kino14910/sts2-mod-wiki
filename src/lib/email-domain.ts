export const ALLOWED_EMAIL_DOMAIN = '@qq.com'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/

export function isAllowedEmail(value: unknown): value is string {
	if (typeof value !== 'string' || value.length > 254) return false
	const email = value.toLowerCase()
	if (!EMAIL_PATTERN.test(email)) return false
	return email.slice(email.lastIndexOf('@')) === ALLOWED_EMAIL_DOMAIN
}
