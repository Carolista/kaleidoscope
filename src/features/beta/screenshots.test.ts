import { afterEach, describe, expect, it, vi } from 'vitest'
import { prepareScreenshot, screenshotExtension } from './screenshots'

const MB = 1024 * 1024

function fileOf(bytes: number, type = 'image/png') {
	return new File([new Uint8Array(bytes)], 'shot.png', { type })
}

afterEach(() => {
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

describe('screenshotExtension', () => {
	it('names the file by its type', () => {
		expect(screenshotExtension('image/png')).toBe('png')
		expect(screenshotExtension('image/webp')).toBe('webp')
		expect(screenshotExtension('image/jpeg')).toBe('jpg')
	})
})

describe('prepareScreenshot', () => {
	it('sends a small screenshot as it is', async () => {
		const file = fileOf(1 * MB)
		await expect(prepareScreenshot(file)).resolves.toBe(file)
	})

	it('scales a large screenshot down and saves it as JPEG', async () => {
		const close = vi.fn()
		vi.stubGlobal(
			'createImageBitmap',
			vi.fn().mockResolvedValue({ width: 4000, height: 2000, close }),
		)
		const drawImage = vi.fn()
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
			fillRect: vi.fn(),
			drawImage,
		} as unknown as CanvasRenderingContext2D)
		const shrunk = new Blob([new Uint8Array(MB)], { type: 'image/jpeg' })
		const toBlob = vi
			.spyOn(HTMLCanvasElement.prototype, 'toBlob')
			.mockImplementation(callback => callback(shrunk))

		await expect(prepareScreenshot(fileOf(4 * MB))).resolves.toBe(shrunk)
		expect(drawImage).toHaveBeenCalledWith(
			expect.anything(),
			0,
			0,
			2000,
			1000,
		)
		expect(toBlob).toHaveBeenCalledWith(
			expect.any(Function),
			'image/jpeg',
			0.9,
		)
		expect(close).toHaveBeenCalled()
	})

	it('does not enlarge a screenshot that is large only in bytes', async () => {
		vi.stubGlobal(
			'createImageBitmap',
			vi
				.fn()
				.mockResolvedValue({ width: 800, height: 600, close: vi.fn() }),
		)
		const drawImage = vi.fn()
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
			fillRect: vi.fn(),
			drawImage,
		} as unknown as CanvasRenderingContext2D)
		vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
			callback => callback(new Blob(['x'], { type: 'image/jpeg' })),
		)
		await prepareScreenshot(fileOf(2 * MB))
		expect(drawImage).toHaveBeenCalledWith(
			expect.anything(),
			0,
			0,
			800,
			600,
		)
	})

	it('refuses an image that cannot be read', async () => {
		vi.stubGlobal(
			'createImageBitmap',
			vi.fn().mockRejectedValue(new Error('bad')),
		)
		await expect(prepareScreenshot(fileOf(3 * MB))).rejects.toThrow(
			'could not be read',
		)
	})

	it('refuses one that is still too large once shrunk', async () => {
		const close = vi.fn()
		vi.stubGlobal(
			'createImageBitmap',
			vi.fn().mockResolvedValue({ width: 100, height: 100, close }),
		)
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
			fillRect: vi.fn(),
			drawImage: vi.fn(),
		} as unknown as CanvasRenderingContext2D)
		vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
			callback => callback(new Blob([new Uint8Array(6 * MB)])),
		)
		await expect(prepareScreenshot(fileOf(8 * MB))).rejects.toThrow(
			'too large',
		)
		expect(close).toHaveBeenCalled()
	})
})
