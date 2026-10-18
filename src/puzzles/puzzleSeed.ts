export function createPuzzleSeed(): string {
	return Array.from(crypto.getRandomValues(new Uint32Array(4)), value =>
		value.toString(16).padStart(8, '0'),
	).join('')
}

export function createUnusedPuzzleSeed(excluded: ReadonlySet<string>): string {
	for (let attempt = 0; attempt < 32; attempt++) {
		const seed = createPuzzleSeed()
		if (!excluded.has(seed)) return seed
	}
	throw new Error('Unable to generate a fresh puzzle seed. Please try again.')
}
