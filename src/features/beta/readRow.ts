// Readers for data that arrives from the server as JSON or a database row, so that a field
// that is missing or the wrong type is an error here and not a surprise in the page.
export type Row = Record<string, unknown>

export function isRow(value: unknown): value is Row {
	return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function text(row: Row, key: string): string {
	const value = row[key]
	if (typeof value !== 'string') throw new Error(`Missing ${key}.`)
	return value
}

// A text field that may be empty in the database.
export function optionalText(row: Row, key: string): string | null {
	const value = row[key]
	if (value === null || value === undefined) return null
	if (typeof value !== 'string') throw new Error(`Bad ${key}.`)
	return value
}

export function time(row: Row, key: string): number {
	const value = Date.parse(text(row, key))
	if (Number.isNaN(value)) throw new Error(`Bad time in ${key}.`)
	return value
}

export function rows(value: unknown): Row[] {
	if (!Array.isArray(value) || !value.every(isRow))
		throw new Error('Unexpected data.')
	return value
}
