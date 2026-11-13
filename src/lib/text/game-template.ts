/** SmartFormat subset used by game descriptions. No entity, asset or UI dependencies. */
export type TemplateVariables = Record<string, string | number | boolean | undefined>

export interface TemplateDiagnostic {
	code: 'missing-variable' | 'unsupported-format' | 'invalid-value' | 'unclosed-variable' | 'depth-limit'
	raw: string
	name: string
}

export interface TemplateOptions {
	variables?: TemplateVariables
	baseVariables?: TemplateVariables
	upgraded?: boolean
	inCombat?: boolean
	locale?: string
	/** Existing upgraded=true callers show an upgrade preview by default. */
	upgradeDisplay?: 'normal' | 'upgraded' | 'preview'
	onDiagnostic?: (diagnostic: TemplateDiagnostic) => void
	renderIcons?: (kind: 'energy' | 'star', count: number, label: string) => string
}

export type TemplateNode =
	| { type: 'text'; value: string; start: number; end: number }
	| { type: 'variable'; raw: string; name: string; args?: string; start: number; end: number }

/** Delimiters inside nested placeholders and formatter options are not separators. */
export function splitTemplate(text: string, separator: string): string[] {
	const parts: string[] = []
	let braces = 0
	let parens = 0
	let start = 0
	for (let i = 0; i < text.length; i++) {
		if (text[i] === '{') braces++
		else if (text[i] === '}') braces--
		else if (text[i] === '(') parens++
		else if (text[i] === ')') parens--
		else if (text[i] === separator && braces === 0 && parens === 0) {
			parts.push(text.slice(start, i))
			start = i + 1
		}
	}
	parts.push(text.slice(start))
	return parts
}

export function parseGameTemplate(src: string): TemplateNode[] {
	const nodes: TemplateNode[] = []
	let cursor = 0
	while (cursor < src.length) {
		const start = src.indexOf('{', cursor)
		if (start < 0) break
		let depth = 1
		let end = start + 1
		for (; end < src.length && depth > 0; end++) {
			if (src[end] === '{') depth++
			else if (src[end] === '}') depth--
		}
		if (depth) break
		if (start > cursor) nodes.push({ type: 'text', value: src.slice(cursor, start), start: cursor, end: start })
		const raw = src.slice(start, end)
		const parts = splitTemplate(raw.slice(1, -1), ':')
		nodes.push({
			type: 'variable', raw, name: parts[0].trim(),
			args: parts.length > 1 ? parts.slice(1).join(':') : undefined,
			start, end
		})
		cursor = end
	}
	if (cursor < src.length) nodes.push({ type: 'text', value: src.slice(cursor), start: cursor, end: src.length })
	return nodes
}

function lookup(vars: TemplateVariables, name: string): string | number | boolean | undefined {
	if (Object.hasOwn(vars, name)) return vars[name]
	// These properties refer to imported scalar DynamicVars, not arbitrary dotted keys.
	const property = /^(.*)\.(BaseValue|PreviewValue|IntValue|StringValue)$/.exec(name)
	if (property && Object.hasOwn(vars, property[1])) return vars[property[1]]
	if (name.startsWith('Calculated') && vars.CalculationBase !== undefined) return vars.CalculationBase
	return undefined
}

function truthy(value: string | number | boolean | undefined): boolean {
	return value !== undefined && value !== false && value !== '' && value !== 0 && value !== '0' && value !== 'false'
}

/** Convert.ToInt32(decimal) rounds midpoints to even (unlike Math.round). */
function roundEven(n: number): number {
	const floor = Math.floor(n)
	if (Math.abs(n - floor - 0.5) <= Number.EPSILON * Math.max(1, Math.abs(n)) * 4) {
		return floor % 2 === 0 ? floor : floor + 1
	}
	return Math.round(n)
}

interface Current { name: string; value: string | number | boolean | undefined }

export function resolveGameTemplate(src: string, options: TemplateOptions = {}): string {
	const variables = options.variables ?? {}
	const baseVariables = options.baseVariables ?? variables
	const preview = options.upgradeDisplay === 'preview' || (options.upgradeDisplay === undefined && options.upgraded === true)
	const upgraded = options.upgradeDisplay === 'normal' ? false : options.upgraded === true || options.upgradeDisplay === 'upgraded' || options.upgradeDisplay === 'preview'
	const report = (code: TemplateDiagnostic['code'], raw: string, name = '') => {
		options.onDiagnostic?.({ code, raw, name })
		return raw
	}
	const highlight = (name: string, value: string) => preview && String(lookup(baseVariables, name) ?? '') !== String(lookup(variables, name) ?? '')
		? `[green]${value}[/green]` : value
	const icons = options.renderIcons ?? ((kind, count, label) => count > 0 && count < 5
		? `[${kind}_icons=${count}]` : `${label}[${kind}_icons=1]`)

	function resolve(text: string, current?: Current, depth = 0): string {
		if (depth >= 32) return report('depth-limit', text, current?.name)
		return parseGameTemplate(text).map((node) => {
			if (node.type === 'text') {
				if (node.value.includes('{')) report('unclosed-variable', node.value)
				return node.value
			}
			const { name, args, raw } = node
			let value = name ? lookup(variables, name) : current?.value
			if (name === 'IfUpgraded') value = upgraded
			else if (name === 'InCombat') value = options.inCombat ?? false
			else if (name === 'IsTargeting' || name === 'OnTable') value ??= false
			else if (name === 'energyPrefix') value ??= 'colorless'
			const ref: Current = { name: name || current?.name || '', value }
			const display = value === undefined ? '' : String(value)
			const nested = (picked: string) => resolve(picked, ref, depth + 1)
			const invalid = () => report('invalid-value', raw, name)

			if (args === undefined) {
				if (name === 'singleStarIcon') return icons('star', 1, '1')
				return value === undefined ? report('missing-variable', raw, name) : display
			}
			if (args === 'diff()' || args === 'inverseDiff()') {
				return value === undefined ? report('missing-variable', raw, name) : highlight(ref.name, display)
			}
			if (args === 'abs()') return Number.isFinite(Number(value)) ? String(Math.abs(Number(value))) : invalid()
			if (args === 'percentMore()' || args === 'percentLess()') {
				if (value === undefined || !Number.isFinite(Number(value))) return invalid()
				return String(roundEven((args === 'percentMore()' ? Number(value) - 1 : 1 - Number(value)) * 100))
			}
			const icon = /^(energy|star)Icons\((\d*)\)$/.exec(args)
			if (icon) {
				const numeric = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)))
				const count = numeric ? Math.trunc(Number(value)) : icon[2] ? Number(icon[2]) : NaN
				if (!Number.isSafeInteger(count)) return invalid()
				return icons(icon[1] as 'energy' | 'star', count, highlight(ref.name, String(count)))
			}
			if (args.startsWith('show:') && name === 'IfUpgraded') {
				const branches = splitTemplate(args.slice(5), '|')
				if (branches.length > 2) return report('unsupported-format', raw, name)
				const result = nested(upgraded ? branches[0] : branches[1] ?? '')
				return upgraded && preview && result ? `[green]${result}[/green]` : result
			}
			const choose = /^choose\(([^)]*)\):([\s\S]*)$/.exec(args)
			if (choose) {
				const choices = choose[1].split('|')
				const branches = splitTemplate(choose[2], '|')
				const index = choices.indexOf(display)
				if (index < 0 && branches.length <= choices.length) return report('invalid-value', raw, name)
				return nested(branches[index < 0 ? choices.length : index] ?? '')
			}
			if (args.startsWith('cond:')) {
				const branches = splitTemplate(args.slice(5), '|')
				if (!branches.some((part) => /^(>=|<=|==|!=|>|<|=)\s*-?\d/.test(part))) {
					if (branches.length > 2) return report('unsupported-format', raw, name)
					return nested(truthy(value) ? branches[0] : branches[1] ?? '')
				}
				for (const part of branches) {
					const comparison = /^(>=|<=|==|!=|>|<|=)\s*(-?\d+(?:\.\d+)?)\?([\s\S]*)$/.exec(part)
					if (!comparison) return part.includes('?') ? report('unsupported-format', raw, name) : nested(part)
					const n = Number(value)
					const target = Number(comparison[2])
					const yes = comparison[1] === '>' ? n > target : comparison[1] === '<' ? n < target
						: comparison[1] === '>=' ? n >= target : comparison[1] === '<=' ? n <= target
							: comparison[1] === '!=' ? n !== target : n === target
					if (yes) return nested(comparison[3])
				}
				return ''
			}
			const plural = /^plural(?:\(([^)]*)\))?:([\s\S]*)$/.exec(args)
			if (plural) {
				const branches = splitTemplate(plural[2], '|')
				if (value === undefined || !Number.isFinite(Number(value))) return invalid()
				if (branches.length < 1 || branches.length > 2 || (plural[1] && !/^(eng|en|zhs|zh)$/.test(plural[1]))) {
					return report('unsupported-format', raw, name)
				}
				// SmartFormat's explicit singular/plural forms are used even in Chinese templates.
				return nested(Number(value) === 1 ? branches[0] : branches[1] ?? branches[0])
			}
			const branches = splitTemplate(args, '|')
			// SmartFormat's default boolean conditional (InCombat, OnTable, etc.).
			if (branches.length === 2 && !/^[\w]+(?:\([^)]*\))?:/.test(args)) {
				return nested(truthy(value) ? branches[0] : branches[1])
			}
			return report('unsupported-format', raw, name)
		}).join('')
	}
	return resolve(src)
}
