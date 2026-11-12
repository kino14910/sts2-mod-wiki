import raw from './relic-wiki.json'
import navboxRaw from './relic-wiki-navbox.json'

const WIKI_IMG = '/mods/sts2/images/wiki/relic/'
const RELIC_IMG = '/mods/sts2/images/relics/'

export const RELIC_WIKI_IMAGES: Record<string, string> = {
	backing: `${WIKI_IMG}relic_backing_200px.png`,
	frame: `${WIKI_IMG}relic_frame_common_224px.png`,
	crackedCore: `${WIKI_IMG}cracked_core_128px.png`,
	crackedCoreIcon: `${WIKI_IMG}cracked_core_24px.png`,
	infusedCore: `${WIKI_IMG}infused_core_24px.png`,
	touchOfOrobas: `${WIKI_IMG}touch_of_orobas_24px.png`,
	dataDisk: `${RELIC_IMG}data_disk.png`,
	goldPlatedCables: `${RELIC_IMG}gold_plated_cables.png`,
	symbioticVirus: `${RELIC_IMG}symbiotic_virus.png`,
	metronome: `${RELIC_IMG}metronome.png`,
	lightning: `${WIKI_IMG}lightning_orb_18px.png`,
	lightningLarge: `${WIKI_IMG}lightning_orb_28px.png`,
	dark: `${WIKI_IMG}dark_orb_18px.png`,
	focus: `${WIKI_IMG}icon_focus_18px.png`,
	focusLarge: `${WIKI_IMG}icon_focus_22px.png`,
	defect: `${WIKI_IMG}icon_defect_18px.png`,
	orobas: `${WIKI_IMG}icon_orobas_18px.png`,
	cardSkillCommon: `${WIKI_IMG}card_icon_defect_skill_common_24px.png`,
	cardSkillUncommon: `${WIKI_IMG}card_icon_defect_skill_uncommon_24px.png`,
	cardSkillRare: `${WIKI_IMG}card_icon_defect_skill_rare_24px.png`,
	cardSkillAncient: `${WIKI_IMG}card_icon_defect_skill_ancient_24px.png`,
	cardAttackCommon: `${WIKI_IMG}card_icon_defect_attack_common_24px.png`,
	cardAttackUncommon: `${WIKI_IMG}card_icon_defect_attack_uncommon_24px.png`,
	cardAttackRare: `${WIKI_IMG}card_icon_defect_attack_rare_24px.png`,
	cardPowerRare: `${WIKI_IMG}card_icon_defect_power_rare_24px.png`,
	cardPowerUncommon: `${WIKI_IMG}card_icon_defect_power_uncommon_24px.png`
}

export interface RelicWikiToken {
	text?: string
	icon?: string
	href?: string
	tooltip?: string
	bold?: boolean
}

export interface RelicWikiSection {
	id: string
	title: string
	level: 2 | 3
	number?: string
	indent?: boolean
	paragraphs?: string[]
	lists?: string[][]
	table?: 'updateHistory'
}

export interface RelicWikiCell {
	text?: string
	subtext?: string
	lines?: string[]
	href?: string
}

export interface RelicWikiTable {
	columns: string[]
	rows: RelicWikiCell[][]
}

export interface RelicWikiGlossary {
	title: string
	icon?: string
	infoHref?: string
	text: string
}

export interface RelicWikiTab {
	label: string
	href?: string
	current?: boolean
}

export interface RelicWikiInfobox {
	variants: string[]
	rarity: { label: string; href: string }
	character: { label: string; href: string; tone: string }
	image: { backing: string; frame: string; art: string; alt: string; fileHref: string }
	description: string
	flavor: string
}

export interface RelicWikiPage {
	title: string
	gameTabs: RelicWikiTab[]
	infobox: RelicWikiInfobox
	glossary: RelicWikiGlossary[]
	intro: string[]
	sections: RelicWikiSection[]
	updateHistory: RelicWikiTable
	tokens: Record<string, RelicWikiToken>
	tooltips: Record<string, string>
}

export interface RelicWikiNavboxItem {
	name: string
	href: string | null
}

export interface RelicWikiNavboxRow {
	group: string
	href: string
	items: RelicWikiNavboxItem[]
}

export interface RelicWikiNavboxGroup {
	label: string
	href: string | null
	rows: RelicWikiNavboxRow[]
}

export interface RelicWikiNavbox {
	title: string
	href: string
	templateHref: string
	groups: RelicWikiNavboxGroup[]
}

export const RELIC_WIKI = raw as unknown as Record<string, RelicWikiPage>
export const RELIC_WIKI_NAVBOX = navboxRaw as unknown as RelicWikiNavbox

export function relicImage(key: string | undefined) {
	return key ? (RELIC_WIKI_IMAGES[key] ?? key) : ''
}

export function relicWikiToken(page: RelicWikiPage, key: string): RelicWikiToken {
	return page.tokens[key] ?? { text: key }
}
