const STORAGE_KEY = 'kaleidoscope:export:includeGridLines'
const TRANSPARENT_STORAGE_KEY = 'kaleidoscope:export:transparentBackground'

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

export function getTransparentBackground(): boolean {
	try {
		return localStorage.getItem(TRANSPARENT_STORAGE_KEY) === 'true'
	} catch (error) {
		console.warn('Unable to read the image export preference.', error)
		return false
	}
}

export function saveTransparentBackground(transparent: boolean): void {
	try {
		localStorage.setItem(TRANSPARENT_STORAGE_KEY, String(transparent))
	} catch (error) {
		console.warn('Unable to save the image export preference.', error)
	}
}
