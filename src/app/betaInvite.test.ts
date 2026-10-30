import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	captureBetaInvite,
	clearBetaInvite,
	readBetaInvite,
} from './betaInvite'

const token = `b${'a1'.repeat(32)}`

beforeEach(() => localStorage.clear())
afterEach(() => {
	vi.useRealTimers()
	window.history.replaceState(null, '', '/')
})

describe('betaInvite', () => {
	it('keeps the token from an invite link and cleans the address', () => {
		window.history.replaceState(null, '', `/#/beta?invite=${token}`)
		captureBetaInvite()
		expect(readBetaInvite()).toBe(token)
		expect(window.location.hash).toBe('#/beta')
	})

	it('ignores other addresses and malformed tokens', () => {
		window.history.replaceState(null, '', '/#/beta')
		captureBetaInvite()
		window.history.replaceState(null, '', '/#/beta?invite=short')
		captureBetaInvite()
		window.history.replaceState(null, '', `/#/admin?invite=${token}`)
		captureBetaInvite()
		expect(readBetaInvite()).toBeNull()
		expect(window.location.hash).toBe(`#/admin?invite=${token}`)
	})

	it('forgets a token once it is cleared or a week old', () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-11-01T12:00:00Z'))
		window.history.replaceState(null, '', `/#/beta?invite=${token}`)
		captureBetaInvite()
		vi.setSystemTime(new Date('2026-11-07T12:00:00Z'))
		expect(readBetaInvite()).toBe(token)
		vi.setSystemTime(new Date('2026-11-08T12:00:01Z'))
		expect(readBetaInvite()).toBeNull()
		window.history.replaceState(null, '', `/#/beta?invite=${token}`)
		captureBetaInvite()
		clearBetaInvite()
		expect(readBetaInvite()).toBeNull()
	})

	it('discards a stored value it cannot read', () => {
		localStorage.setItem('kaleidoscope:beta-invite', '{nope')
		expect(readBetaInvite()).toBeNull()
		localStorage.setItem(
			'kaleidoscope:beta-invite',
			JSON.stringify({ token: 'x', at: Date.now() }),
		)
		expect(readBetaInvite()).toBeNull()
		expect(localStorage.getItem('kaleidoscope:beta-invite')).toBeNull()
	})
})
