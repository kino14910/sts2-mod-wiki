import { isValidEntityId, isValidModId } from '#lib/entities'

/**
 * Wiki 实体引用的唯一语法：[[namespace:EntityType:EntityId]]
 *
 * namespace 是模组 ID，EntityType 是固定类型名，EntityId 是游戏数据中的稳定 ID。
 * 不支持省略 namespace、缩写、别名或按中英文名称识别。
 */
export const WIKI_ENTITY_TYPES = {
	Card: 'card',
	Relic: 'relic',
	Potion: 'potion',
	Power: 'power',
	Keyword: 'keyword',
	Character: 'character'
} as const

export type WikiEntityTypeName = keyof typeof WIKI_ENTITY_TYPES

export interface WikiEntityReference {
	namespace: string
	entityType: WikiEntityTypeName
	entityId: string
}

const ENTITY_REFERENCE = /^([a-z0-9][a-z0-9._-]{0,63}):(Card|Relic|Potion|Power|Keyword|Character):([^:]+)$/

export function parseWikiEntityReference(value: string): WikiEntityReference | null {
	const match = ENTITY_REFERENCE.exec(value.trim())
	if (!match) return null
	const [, namespace, entityType, rawId] = match
	const entityId = rawId.trim()
	if (!isValidModId(namespace) || !isValidEntityId(entityId)) return null
	return { namespace, entityType: entityType as WikiEntityTypeName, entityId }
}
