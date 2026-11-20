import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async () => {
	error(410, 'Email verification is retired. Registration requires an invitation code.')
}
