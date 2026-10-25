// Words AP style keeps lowercase in a title unless they come first (or follow a
// colon): articles, conjunctions, and prepositions of three letters or fewer.
const LOWERCASE_WORDS = new Set([
	'a',
	'an',
	'the',
	'and',
	'but',
	'or',
	'nor',
	'for',
	'so',
	'yet',
	'as',
	'at',
	'by',
	'if',
	'in',
	'of',
	'out',
	'per',
	'to',
	'via',
	'vs',
])

// "in" and "out" after these are part of the verb, not a preposition: "Sign In".
const PHRASAL_VERBS = new Set(['sign', 'log'])

function capitalize(word: string) {
	return word.replace(/\p{L}/u, letter => letter.toUpperCase())
}

// Words that already carry capitals (iPhone, FAQ, PNG) are left as written.
function hasCapital(word: string) {
	return /\p{Lu}/u.test(word)
}

// `startsTitle` is false for text that continues a title begun earlier.
export function toTitleCase(text: string, startsTitle = true): string {
	let capitalizeNext = startsTitle
	let previous = ''
	return text
		.split(/(\s+)/)
		.map(part => {
			if (!part.trim()) return part
			const word = part.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
			const lower = word.toLowerCase()
			const keepLower =
				!capitalizeNext &&
				LOWERCASE_WORDS.has(lower) &&
				!PHRASAL_VERBS.has(previous)
			previous = lower
			const result =
				keepLower || hasCapital(word) ? part : capitalize(part)
			capitalizeNext = part.endsWith(':')
			return result
		})
		.join('')
}
