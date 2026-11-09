/**
 * 前置库 Entry ID 生成规则。
 *
 * 算法与 tools/id-generator 中原有实现保持一致，工具页与数据加载层共用此模块，
 * 避免出现第二套 ID 规则。
 */

const whitespaceRegex = /\s+/g;
const specialCharRegex = /[^A-Z0-9_]/g;
const nonAlphaNumericRegex = /[^A-Za-z0-9]+/g;
const acronymBoundaryRegex = /([A-Z]+)([A-Z][a-z])/g;
const camelBoundaryRegex = /([a-z0-9])([A-Z])/g;
const repeatedUnderscoreRegex = /_+/g;

export interface SegmentAnalysis {
	input: string;
	trimmed: string;
	afterCamelCase: string;
	afterUppercase: string;
	afterWhitespace: string;
	result: string;
	tokens: string[];
}

interface GameCamelCaseMatch {
	index: number;
	length: number;
	group1: string;
	group2: string;
}

export function normalizeSegment(value: string): string {
	return analyzeSegment(value).result;
}

export function normalizeSegments(values: string[]): string {
	return values.map(normalizeSegment).join('_');
}

export function buildBaseLibEntryId(namespaceValue: string, idValue: string): string {
	return `${getBaseLibNamespacePrefix(namespaceValue)}-${normalizeSegment(idValue)}`;
}

export function buildRitsuLibEntryId(
	modIdValue: string,
	modelTypeValue: string,
	idValue: string
): string {
	return `${normalizePublicStem(modIdValue)}_${normalizePublicStem(modelTypeValue)}_${normalizePublicStem(idValue)}`;
}

export function normalizePublicStem(value: string): string {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new Error('Public stem must not be empty.');
	}

	let normalized = value.trim().replace(nonAlphaNumericRegex, '_');
	normalized = normalized.replace(acronymBoundaryRegex, '$1_$2');
	normalized = normalized.replace(camelBoundaryRegex, '$1_$2');
	normalized = normalized.replace(repeatedUnderscoreRegex, '_');
	return normalized.replace(/^_+|_+$/g, '').toUpperCase();
}

export function getBaseLibNamespacePrefix(value: string): string {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new Error('Namespace must not be empty.');
	}

	const firstSegment = value.trim().split('.')[0].trim();
	if (firstSegment.length === 0) {
		throw new Error('Namespace prefix must not be empty.');
	}

	return firstSegment.toUpperCase();
}

export function analyzeSegment(value: string): SegmentAnalysis {
	if (typeof value !== 'string') {
		throw new Error('Segment must be a string.');
	}

	const trimmed = value.trim();
	const afterCamelCase = replaceGameCamelCase(trimmed);
	const afterUppercase = afterCamelCase.toUpperCase();
	const afterWhitespace = afterUppercase.replace(whitespaceRegex, '_');
	const result = afterWhitespace.replace(specialCharRegex, '');

	return {
		input: value,
		trimmed,
		afterCamelCase,
		afterUppercase,
		afterWhitespace,
		result,
		tokens: result.length === 0 ? [] : result.split('_')
	};
}

function replaceGameCamelCase(value: string): string {
	let result = '';
	let appendFrom = 0;
	let searchFrom = 0;

	while (searchFrom < value.length) {
		const match = findGameCamelCaseMatch(value, searchFrom);
		if (match === null) {
			break;
		}

		result += value.slice(appendFrom, match.index);
		result += `${match.group1}_${match.group2}`;
		appendFrom = match.index + match.length;
		searchFrom = appendFrom;
	}

	return result + value.slice(appendFrom);
}

function findGameCamelCaseMatch(value: string, searchFrom: number): GameCamelCaseMatch | null {
	for (let index = searchFrom; index < value.length; index += 1) {
		if (
			isAsciiAlphaNumeric(value[index]) &&
			index + 1 < value.length &&
			isAsciiUpper(value[index + 1])
		) {
			return {
				index,
				length: 2,
				group1: value[index],
				group2: value[index + 1]
			};
		}

		if (index === searchFrom && index !== 0 && isAsciiUpper(value[index])) {
			return {
				index,
				length: 1,
				group1: '',
				group2: value[index]
			};
		}
	}

	return null;
}

function isAsciiAlphaNumeric(char: string) {
	return /^[A-Za-z0-9]$/.test(char);
}

function isAsciiUpper(char: string) {
	return /^[A-Z]$/.test(char);
}

/** 供 tools/id-generator 的静态脚本注入使用的 API 对象 */
export const RitsuLibEntryId = Object.freeze({
	analyzeSegment,
	buildBaseLibEntryId,
	buildRitsuLibEntryId,
	getBaseLibNamespacePrefix,
	normalizePublicStem,
	normalizeSegment,
	normalizeSegments
});
