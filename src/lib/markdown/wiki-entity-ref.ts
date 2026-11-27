import { isValidEntityId, isValidModId, resolvePublicEntityRef, type EntityType, type ScopedEntityRef } from '#lib/entities'
import { scopedEntityKey } from '#lib/data/entities'
import { findEntityCandidates } from '#lib/data/entity-name-index'
import { WIKI_ENTITY_TYPES, type WikiEntityReference } from './wiki-entity-syntax'

export { parseWikiEntityReference, WIKI_ENTITY_TYPES, type WikiEntityReference, type WikiEntityTypeName } from './wiki-entity-syntax'

/**
 * 解析结果始终是带 namespace 的 ScopedEntityRef，后续展示统一复用实体数据层。
 *
 * Keyword 额外接受「实体英文标题」作为 key：游戏数据里的 Buff ID 是 VulnerablePower，
 * 而 Wiki 侧稳定使用 Vulnerable。该回退只匹配英文 canonical 标题或数据 ID，
 * 不会按中文名或任意别名自动识别实体。
 */
export function resolveWikiEntityReference(reference: WikiEntityReference): ScopedEntityRef | null {
	const type: EntityType | undefined = WIKI_ENTITY_TYPES[reference.entityType]
	if (!type) return null
	if (!isValidModId(reference.namespace) || !isValidEntityId(reference.entityId)) return null

	const direct = resolvePublicEntityRef({ type, id: reference.entityId, modId: reference.namespace })
	if (direct) return direct
	if (type !== 'keyword' && type !== 'power') return null

	const candidates = findEntityCandidates(reference.entityId, 'eng').filter((candidate) =>
		(candidate.entity.kind === 'keyword' || candidate.entity.kind === 'power') &&
		candidate.source !== 'alias' &&
		(candidate.ref.modId ?? 'sts2') === reference.namespace
	)
	const unique = new Map(candidates.map((candidate) => [scopedEntityKey(candidate.ref), candidate.ref]))
	if (unique.size !== 1) return null
	return resolvePublicEntityRef([...unique.values()][0])
}
