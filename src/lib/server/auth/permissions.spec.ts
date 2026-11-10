import { describe, expect, it } from 'vitest'
import { can, hasPermission, rolePermissions, type Role } from './permissions'

describe('roles and permissions', () => {
	it('member can only propose edits', () => {
		expect(can('member', 'wiki:proposal:create')).toBe(true)
		expect(can('member', 'wiki:revision:publish')).toBe(false)
		expect(can('member', 'wiki:proposal:review')).toBe(false)
		expect(can('member', 'user:role:manage')).toBe(false)
	})

	it('trusted can publish without review', () => {
		expect(can('trusted', 'wiki:revision:publish')).toBe(true)
		expect(can('trusted', 'wiki:proposal:review')).toBe(false)
	})

	it('moderator can review but cannot change roles', () => {
		expect(can('moderator', 'wiki:proposal:review')).toBe(true)
		expect(can('moderator', 'wiki:revision:revert')).toBe(true)
		expect(can('moderator', 'user:role:manage')).toBe(false)
	})

	it('admin holds every permission', () => {
		const all = rolePermissions('admin')
		for (const role of ['member', 'trusted', 'moderator', 'admin'] as Role[]) {
			for (const permission of rolePermissions(role)) expect(all).toContain(permission)
		}
	})

	it('denies anonymous and suspended sessions for every write', () => {
		expect(hasPermission(null, 'wiki:proposal:create')).toBe(false)
		expect(hasPermission(undefined, 'comment:create')).toBe(false)
		expect(
			hasPermission(
				{ role: 'admin', status: 'suspended' },
				'user:role:manage'
			)
		).toBe(false)
	})

	it('never grants a role permission from client-supplied role names', () => {
		expect(can('__hacker__' as Role, 'wiki:revision:publish')).toBe(false)
	})

	it('keeps mod source management separate from trusted publishing', () => {
		expect(can('trusted', 'wiki:revision:publish')).toBe(true)
		expect(can('trusted', 'wiki:source:sync')).toBe(false)
		expect(can('trusted', 'wiki:source:review')).toBe(false)
		expect(can('trusted', 'wiki:source:view')).toBe(false)
	})

	it('moderator can inspect upstream updates but cannot resolve them', () => {
		expect(can('moderator', 'wiki:source:view')).toBe(true)
		expect(can('moderator', 'wiki:source:review')).toBe(false)
		expect(can('moderator', 'wiki:source:sync')).toBe(false)
	})

	it('admin exclusively handles mod upstream updates', () => {
		expect(can('admin', 'wiki:source:view')).toBe(true)
		expect(can('admin', 'wiki:source:review')).toBe(true)
		expect(can('admin', 'wiki:source:sync')).toBe(true)
		expect(hasPermission({ role: 'member', status: 'active' }, 'wiki:source:sync')).toBe(false)
	})
})
