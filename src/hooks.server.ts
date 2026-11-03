import { paraglideMiddleware } from '#lib/paraglide/server';
import type { Handle } from '@sveltejs/kit/hooks';

export const handle: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ locale }) => {
		const langTag = { eng: 'en', zhs: 'zh-Hans' }[locale] ?? locale;
		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', langTag)
		});
	});
