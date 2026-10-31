export const MAX_SCREENSHOTS = 3
export const SCREENSHOT_TYPES = ['image/png', 'image/jpeg', 'image/webp']

// The storage bucket's own limit; a larger image is shrunk before it is uploaded.
const MAX_BYTES = 5 * 1024 * 1024
const KEEP_ORIGINAL_UNDER = 1.5 * 1024 * 1024
const MAX_EDGE = 2000

export function isScreenshotType(type: string): boolean {
	return SCREENSHOT_TYPES.includes(type)
}

export function screenshotExtension(type: string): string {
	if (type === 'image/png') return 'png'
	if (type === 'image/webp') return 'webp'
	return 'jpg'
}

// A phone's screenshots are often several megabytes at full size, more than anyone needs to
// see a bug. Small ones go as they are; larger ones are scaled down and saved as JPEG.
export async function prepareScreenshot(file: Blob): Promise<Blob> {
	if (file.size <= KEEP_ORIGINAL_UNDER) return file
	let bitmap: ImageBitmap
	try {
		bitmap = await createImageBitmap(file)
	} catch {
		throw new Error('One of the screenshots could not be read.')
	}
	try {
		const scale = Math.min(
			1,
			MAX_EDGE / Math.max(bitmap.width, bitmap.height),
		)
		const canvas = document.createElement('canvas')
		canvas.width = Math.max(1, Math.round(bitmap.width * scale))
		canvas.height = Math.max(1, Math.round(bitmap.height * scale))
		const context = canvas.getContext('2d')
		if (!context) throw new Error('This browser cannot shrink screenshots.')
		// JPEG has no transparency, which would otherwise turn black.
		context.fillStyle = '#fff'
		context.fillRect(0, 0, canvas.width, canvas.height)
		context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
		const shrunk = await new Promise<Blob | null>(resolve =>
			canvas.toBlob(resolve, 'image/jpeg', 0.9),
		)
		if (!shrunk || shrunk.size > MAX_BYTES)
			throw new Error('One of the screenshots is too large to send.')
		return shrunk
	} finally {
		bitmap.close()
	}
}
