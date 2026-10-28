export const CELEBRATIONS: readonly string[] = [
	'Congrats',
	'Great work',
	'Awesome',
	'Well done',
	'Way to go',
	'You did it',
	'Impressive',
	'Fantastic',
	'Bravo',
	'Amazing',
	'Woohoo',
	'Hooray',
]

// `random` is injectable so tests can pick a specific message.
export function pickCelebration(random: () => number = Math.random): string {
	return `${CELEBRATIONS[Math.floor(random() * CELEBRATIONS.length)]}!`
}
