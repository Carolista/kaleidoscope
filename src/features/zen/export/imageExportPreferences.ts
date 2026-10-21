const STORAGE_KEY = 'kaleidoscope:export:includeGridLines'

export function getIncludeGridLines(): boolean {
	try {
		return localStorage.getItem(STORAGE_KEY) !== 'false'
	} catch (error) {
		console.warn('Unable to read the image export preference.', error)
		return true
	}
}

export function saveIncludeGridLines(includeGridLines: boolean): void {
	try {
		localStorage.setItem(STORAGE_KEY, String(includeGridLines))
	} catch (error) {
		console.warn('Unable to save the image export preference.', error)
	}
}
