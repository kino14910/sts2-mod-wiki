import { error } from '@sveltejs/kit';
import { CARDS, MOD_BY_ID } from '#lib/data/mods';
import { m } from '#lib/paraglide/messages';

export function load({ params }: { params: { id: string } }) {
	const index = CARDS.findIndex((card) => card.id === params.id);
	if (index === -1) {
		error(404, m.card_not_found());
	}

	const card = CARDS[index];
	const mod = MOD_BY_ID.get(card.mod);

	const related = CARDS.filter(
		(entry) => entry.id !== card.id && entry.color === card.color
	).slice(0, 3);

	const fallbackRelated =
		related.length > 0
			? related
			: CARDS.filter((entry) => entry.id !== card.id && entry.type === card.type).slice(0, 3);

	return {
		card,
		mod,
		related: fallbackRelated,
		prev: CARDS[index - 1] ?? null,
		next: CARDS[index + 1] ?? null
	};
}
