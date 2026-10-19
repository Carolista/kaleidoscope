// A named palette of 5 colors the user can paint the kaleidoscope with.
export interface Palette {
	readonly name: string
	readonly colors: readonly [string, string, string, string, string]
}
