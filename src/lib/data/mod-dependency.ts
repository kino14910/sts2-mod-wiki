import { buildBaseLibEntryId, buildRitsuLibEntryId, normalizeSegment } from './entry-id';

/**
 * 前置依赖：决定该模组内容的 Entry ID 与本地化 Key 如何生成。
 *
 * - baselib：由命名空间首段生成前缀（NAMESPACE-ID）
 * - ritsulib：由 modid + 内容类别生成前缀（MOD_<CATEGORY>_ID）
 * - other：由开发者填写前缀（可为空），不经过前置库规则
 */
export type ModDependency =
	| { type: 'baselib'; namespace: string }
	| { type: 'ritsulib'; modid: string }
	| { type: 'other'; prefix?: string };

/** 内容类别，由加载层按内容自动传入，无需在 manifest 中声明 */
export type ContentKind = 'card' | 'power' | 'relic' | 'potion';

/** 本地化 Key 的字段名 */
export type LocalizedField = 'title' | 'description';

/** RitsuLib 的内容类别段；与 tools/id-generator 的模型类别保持一致 */
const RITSULIB_MODEL_TYPE: Record<ContentKind, string> = {
	card: 'card',
	power: 'power',
	relic: 'relic',
	potion: 'potion'
};

const namespaceRegex = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;
const modIdRegex = /^[A-Za-z0-9_]+$/;
const prefixRegex = /^[A-Za-z0-9_]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
	return typeof value === 'string';
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]) {
	return Object.keys(value).every((key) => allowed.includes(key));
}

/**
 * 校验依赖声明。严格限制每种类型允许的字段，避免出现 namespace/modid/prefix
 * 同时存在或重复声明内容类别之类的冗余配置。
 */
export function isModDependency(value: unknown): value is ModDependency {
	if (!isRecord(value)) return false;

	if (value.type === 'baselib') {
		return (
			hasOnlyKeys(value, ['type', 'namespace']) &&
			isString(value.namespace) &&
			namespaceRegex.test(value.namespace)
		);
	}

	if (value.type === 'ritsulib') {
		return (
			hasOnlyKeys(value, ['type', 'modid']) &&
			isString(value.modid) &&
			modIdRegex.test(value.modid)
		);
	}

	if (value.type === 'other') {
		return (
			hasOnlyKeys(value, ['type', 'prefix']) &&
			(value.prefix === undefined ||
				(isString(value.prefix) && prefixRegex.test(value.prefix)))
		);
	}

	return false;
}

/** 生成内容条目的 Entry ID（不含 .title / .description 字段后缀） */
export function entryIdFor(
	dependency: ModDependency,
	kind: ContentKind,
	id: string
): string {
	switch (dependency.type) {
		case 'baselib':
			return buildBaseLibEntryId(dependency.namespace, id);
		case 'ritsulib':
			return buildRitsuLibEntryId(dependency.modid, RITSULIB_MODEL_TYPE[kind], id);
		case 'other':
			return `${dependency.prefix ?? ''}${normalizeSegment(id)}`;
	}
}

/** 生成完整本地化 Key，例如 FGO_CARD_STRIKE.title */
export function localizationKeyFor(
	dependency: ModDependency,
	kind: ContentKind,
	id: string,
	field: LocalizedField
): string {
	return `${entryIdFor(dependency, kind, id)}.${field}`;
}

/** 从已合并的本地化键值表中读取内容文本 */
export function resolveContentText(
	texts: Record<string, string> | undefined,
	dependency: ModDependency | undefined,
	kind: ContentKind,
	id: string,
	field: LocalizedField
): string | undefined {
	if (!texts || !dependency) return undefined;
	return texts[localizationKeyFor(dependency, kind, id, field)];
}
