import { describe, expect, it } from 'vitest'
import { toTitleCase } from './toTitleCase'

describe('toTitleCase', () => {
	it.each([
		['sign in or create an account', 'Sign In or Create an Account'],
		['switch to light mode', 'Switch to Light Mode'],
		[
			'import progress from this device',
			'Import Progress From This Device',
		],
		['change email', 'Change Email'],
		['sign out', 'Sign Out'],
		['log in to your account', 'Log In to Your Account'],
		['stay in the game', 'Stay in the Game'],
		['step out of line', 'Step out of Line'],
		['sign in or log out', 'Sign In or Log Out'],
		['go to the puzzle sets', 'Go to the Puzzle Sets'],
		['the end', 'The End'],
		['a day at the beach', 'A Day at the Beach'],
	])('%s -> %s', (input, expected) => {
		expect(toTitleCase(input)).toBe(expected)
	})

	it('capitalizes a small word that comes first, or after a colon', () => {
		expect(toTitleCase('to begin: the first step')).toBe(
			'To Begin: The First Step',
		)
	})

	it('leaves words that already have capitals alone', () => {
		expect(toTitleCase('save as PNG on your iPhone')).toBe(
			'Save as PNG On Your iPhone',
		)
	})

	it('handles punctuation, apostrophes, and an ellipsis', () => {
		expect(toTitleCase('saving…')).toBe('Saving…')
		expect(toTitleCase("don't save")).toBe("Don't Save")
		expect(toTitleCase('"quoted" words (optional)')).toBe(
			'"Quoted" Words (Optional)',
		)
		expect(toTitleCase('new-game')).toBe('New-game')
	})

	it('continues a title begun elsewhere', () => {
		expect(toTitleCase('to the end', false)).toBe('to the End')
	})

	it('keeps spacing and empty text', () => {
		expect(toTitleCase('  two  spaces ')).toBe('  Two  Spaces ')
		expect(toTitleCase('')).toBe('')
	})
})
