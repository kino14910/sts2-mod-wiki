import type { EntityRef } from '#lib/entities'
import type { IconRef } from '#lib/data/icon-registry'
import type { CollectionVariables } from '#lib/data/collections'
import type { EntityNameEntry, GameEntityType } from '#lib/data/entity-name-index'
import type { CardTextOptions } from '../card-text'

export interface GameTextStyle {
	color?: string
	colorName?: string | null
	font?: string
	fontSize?: string
	bold?: boolean
	italic?: boolean
	underline?: boolean
	align?: 'center' | 'left' | 'right'
}

export interface GameTextTagNode {
	type: 'tag'
	name: string
	arg: string | null
	style: GameTextStyle
	children: GameTextNode[]
}

export type GameTextNode =
	| { type: 'text'; value: string }
	| GameTextTagNode
	| { type: 'entity'; ref: EntityRef; value: string; candidates: readonly EntityNameEntry[] }
	| { type: 'variable'; name: string; raw: string; value: string; children: GameTextNode[] }
	| {
			type: 'icon'
			kind: 'energy' | 'star' | 'asset'
			count: number
			src: string
			ref: IconRef
			raw?: string
			diagnostic?: string
	  }
	| { type: 'break' }

export interface GameTextOptions extends CardTextOptions {
	locale?: string
	/** 遗物 / 药水描述用 collection 变量语法，卡牌描述用 card 语法 */
	mode?: 'card' | 'collection'
	collectionVariables?: CollectionVariables
	current?: EntityRef | null
	prefer?: readonly GameEntityType[]
	/** 关闭实体匹配，仅渲染样式 / 变量 / 图标（卡面缩略图等不可嵌链接处） */
	matchEntities?: boolean
	/** 保留实体节点但不出链接（卡牌大图描述） */
	interactive?: boolean
	/** 图标资源所属模组，默认 sts2 */
	modId?: string
}
