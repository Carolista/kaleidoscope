// A named palette of 5 colors the user can paint the kaleidoscope with.
export interface Palette {
	readonly name: string
	readonly colors: readonly [string, string, string, string, string]
}

// A palette from the database, whose stable ID is what saves and puzzles refer to.
export interface PlayerPalette extends Palette {
	readonly id: string
}
