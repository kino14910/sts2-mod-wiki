/** Card article section keys shared by editorial files, seeding and the refresh script. */
export const CARD_SECTION_KEYS = ['overview', 'obtaining', 'interactions', 'synergies', 'relics', 'notes', 'history'] as const

export type CardSectionKey = (typeof CARD_SECTION_KEYS)[number]
