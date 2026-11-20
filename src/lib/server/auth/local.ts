export function isLocalHost(url: URL): boolean {
	return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
}
