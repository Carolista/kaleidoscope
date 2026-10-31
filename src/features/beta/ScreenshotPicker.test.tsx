import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import ScreenshotPicker, { type Attachment } from './ScreenshotPicker'

function image(name: string, type = 'image/png') {
	return new File(['x'], name, { type })
}

function Harness({ initial = [] }: { initial?: readonly Attachment[] }) {
	const [value, setValue] = useState(initial)
	return <ScreenshotPicker value={value} onChange={setValue} />
}

function attached() {
	return screen
		.queryAllByRole('listitem')
		.map(item => item.textContent?.trim())
}

describe('ScreenshotPicker', () => {
	it('talks about dragging and clicking on a computer, and tapping on a touch device', () => {
		const { unmount } = render(<Harness />)
		expect(screen.getByText(/Drag screenshots here/)).toBeInTheDocument()
		unmount()
		vi.stubGlobal(
			'matchMedia',
			vi.fn().mockReturnValue({
				matches: true,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			}),
		)
		try {
			render(<Harness />)
			expect(screen.getByText(/Tap to choose/)).toBeInTheDocument()
			expect(screen.queryByText(/Drag/)).not.toBeInTheDocument()
		} finally {
			vi.unstubAllGlobals()
		}
	})

	it('attaches several files chosen at once', async () => {
		render(<Harness />)
		await userEvent.upload(screen.getByLabelText(/Drag screenshots here/), [
			image('a.png'),
			image('b.jpg', 'image/jpeg'),
			image('c.webp', 'image/webp'),
		])
		expect(attached()).toEqual(['a.png', 'b.jpg', 'c.webp'])
	})

	it('attaches files dropped onto the area', () => {
		render(<Harness />)
		const zone = screen.getByText(/Drag screenshots here/).closest('label')!
		fireEvent.dragOver(zone)
		fireEvent.drop(zone, {
			dataTransfer: { files: [image('a.png'), image('b.png')] },
		})
		expect(attached()).toEqual(['a.png', 'b.png'])
	})

	it('keeps to three, and says so when some are left out', async () => {
		render(<Harness />)
		await userEvent.upload(screen.getByLabelText(/Drag screenshots here/), [
			image('1.png'),
			image('2.png'),
			image('3.png'),
			image('4.png'),
		])
		expect(attached()).toEqual(['1.png', '2.png', '3.png'])
		expect(screen.getByRole('alert')).toHaveTextContent(
			'up to 3 screenshots',
		)
		expect(screen.getByLabelText(/most you can attach/)).toBeDisabled()
	})

	it('counts what is already attached against the limit', () => {
		render(<Harness />)
		const zone = screen.getByText(/Drag screenshots here/).closest('label')!
		fireEvent.drop(zone, {
			dataTransfer: { files: [image('1.png'), image('2.png')] },
		})
		fireEvent.drop(zone, {
			dataTransfer: { files: [image('3.png'), image('4.png')] },
		})
		expect(attached()).toEqual(['1.png', '2.png', '3.png'])
	})

	it('turns away files that are not PNG, JPEG, or WebP, and keeps the rest', () => {
		render(<Harness />)
		const zone = screen.getByText(/Drag screenshots here/).closest('label')!
		fireEvent.drop(zone, {
			dataTransfer: {
				files: [image('notes.pdf', 'application/pdf'), image('ok.png')],
			},
		})
		expect(attached()).toEqual(['ok.png'])
		expect(screen.getByRole('alert')).toHaveTextContent(
			'Only PNG, JPEG, and WebP',
		)
	})

	it('removes a screenshot, making room for another', async () => {
		render(<Harness />)
		await userEvent.upload(screen.getByLabelText(/Drag screenshots here/), [
			image('1.png'),
			image('2.png'),
			image('3.png'),
		])
		await userEvent.click(
			screen.getByRole('button', { name: 'Remove 2.png' }),
		)
		expect(attached()).toEqual(['1.png', '3.png'])
		expect(screen.getByLabelText(/Drag screenshots here/)).toBeEnabled()
	})

	it('shows previews and releases them when a screenshot is removed or the picker goes', async () => {
		const create = vi.fn((file: Blob) => `blob:${(file as File).name}`)
		const revokeUrl = vi.fn()
		// jsdom has neither, so they are added for this test and removed after it.
		Object.defineProperties(URL, {
			createObjectURL: { value: create, configurable: true },
			revokeObjectURL: { value: revokeUrl, configurable: true },
		})
		try {
			const { unmount } = render(<Harness />)
			await userEvent.upload(
				screen.getByLabelText(/Drag screenshots here/),
				[image('1.png'), image('2.png')],
			)
			expect(document.querySelectorAll('img')).toHaveLength(2)
			await userEvent.click(
				screen.getByRole('button', { name: 'Remove 1.png' }),
			)
			expect(revokeUrl).toHaveBeenCalledWith('blob:1.png')
			unmount()
			expect(revokeUrl).toHaveBeenCalledWith('blob:2.png')
		} finally {
			Reflect.deleteProperty(URL, 'createObjectURL')
			Reflect.deleteProperty(URL, 'revokeObjectURL')
		}
	})
})
