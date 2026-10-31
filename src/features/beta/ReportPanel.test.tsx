import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { NewReport, ReportApi } from './betaReports'
import ReportPanel from './ReportPanel'

function fakeApi(overrides: Partial<ReportApi> = {}) {
	const api: ReportApi = {
		upload: vi.fn(() => Promise.resolve()),
		remove: vi.fn(() => Promise.resolve()),
		submit: vi.fn(() => Promise.resolve()),
		...overrides,
	}
	return api
}

const identity = (file: Blob) => Promise.resolve(file)

function renderPanel(api: ReportApi = fakeApi()) {
	render(
		<ReportPanel
			roundId="round-1"
			userId="user-1"
			api={api}
			prepare={identity}
		/>,
	)
	return api
}

function sent(api: ReportApi): NewReport {
	return vi.mocked(api.submit).mock.calls[0][0]
}

async function fillBug(
	steps = 'Open Zen, tap Save',
	expected = 'An image downloads',
	happened = 'Nothing happens',
) {
	await userEvent.type(
		screen.getByLabelText('What did you expect to happen?'),
		expected,
	)
	await userEvent.type(
		screen.getByLabelText('What happened instead?'),
		happened,
	)
	await userEvent.type(
		screen.getByLabelText(
			'What steps should we take to reproduce the issue?',
		),
		steps,
	)
}

function png(name: string) {
	return new File(['x'], name, { type: 'image/png' })
}

describe('ReportPanel tabs', () => {
	it('opens on the bug report, with both tabs in title case', () => {
		renderPanel()
		expect(
			screen.getByRole('tab', { name: 'Report a Bug' }),
		).toHaveAttribute('aria-selected', 'true')
		expect(
			screen.getByRole('tab', { name: 'Make a Suggestion' }),
		).toHaveAttribute('aria-selected', 'false')
		expect(
			screen.getByRole('form', { name: 'Report a bug' }),
		).toBeInTheDocument()
		expect(
			screen.queryByRole('form', { name: 'Make a suggestion' }),
		).not.toBeInTheDocument()
	})

	it('switches by click and by arrow keys, and keeps what was typed', async () => {
		renderPanel()
		await userEvent.type(
			screen.getByLabelText('What happened instead?'),
			'It froze',
		)
		await userEvent.click(
			screen.getByRole('tab', { name: 'Make a Suggestion' }),
		)
		expect(
			screen.getByRole('form', { name: 'Make a suggestion' }),
		).toBeInTheDocument()
		expect(
			screen.queryByRole('form', { name: 'Report a Bug' }),
		).not.toBeInTheDocument()
		await userEvent.keyboard('{ArrowLeft}')
		expect(screen.getByRole('tab', { name: 'Report a Bug' })).toHaveFocus()
		expect(screen.getByLabelText('What happened instead?')).toHaveValue(
			'It froze',
		)
		await userEvent.keyboard('{End}')
		expect(
			screen.getByRole('tab', { name: 'Make a Suggestion' }),
		).toHaveFocus()
		await userEvent.keyboard('{ArrowRight}')
		expect(screen.getByRole('tab', { name: 'Report a Bug' })).toHaveFocus()
	})
})

describe('bug report', () => {
	it('shows four device details after the questions and before the screenshots', () => {
		renderPanel()
		const device = screen.getByRole('region', { name: 'Your device' })
		expect(
			within(device)
				.getAllByRole('term')
				.map(term => term.textContent),
		).toEqual(['System', 'Browser', 'Viewport', 'Touchscreen'])
		const steps = screen.getByLabelText(
			'What steps should we take to reproduce the issue?',
		)
		const screenshots = screen.getByText('SCREENSHOTS (optional)')
		expect(
			steps.compareDocumentPosition(device) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()
		expect(
			device.compareDocumentPosition(screenshots) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()
	})

	it('sends the answers and the device details, then thanks the tester', async () => {
		const api = renderPanel()
		await fillBug()
		await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
		expect(await screen.findByRole('status')).toHaveTextContent(
			'Thank you! Your bug report was sent.',
		)
		const report = sent(api)
		expect(report).toMatchObject({
			kind: 'bug',
			roundId: 'round-1',
			steps: 'Open Zen, tap Save',
			expected: 'An image downloads',
			happened: 'Nothing happens',
			images: [],
		})
		expect(report.id).toMatch(/^[0-9a-f-]{36}$/)
		expect(report.kind === 'bug' && report.device.userAgent).toBeTruthy()
		expect(api.upload).not.toHaveBeenCalled()
	})

	it('starts a fresh report after another is asked for', async () => {
		const api = renderPanel()
		await fillBug()
		await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
		await userEvent.click(
			await screen.findByRole('button', { name: 'Report Another Bug' }),
		)
		expect(screen.getByLabelText('What happened instead?')).toHaveValue('')
		await fillBug('Other steps')
		await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
		await waitFor(() => expect(api.submit).toHaveBeenCalledTimes(2))
		const [first, second] = vi
			.mocked(api.submit)
			.mock.calls.map(call => call[0])
		expect(second.id).not.toBe(first.id)
	})

	it('does not send an answer that is only spaces', async () => {
		const api = renderPanel()
		await fillBug('   ')
		await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
		expect(screen.getByRole('alert')).toHaveTextContent('answer each')
		expect(api.submit).not.toHaveBeenCalled()
	})

	it('uploads each screenshot under the report, then sends their paths', async () => {
		const prepare = vi.fn(identity)
		const api = fakeApi()
		render(
			<ReportPanel
				roundId="round-1"
				userId="user-1"
				api={api}
				prepare={prepare}
			/>,
		)
		await fillBug()
		await userEvent.upload(screen.getByLabelText(/Drag screenshots here/), [
			png('a.png'),
			png('b.png'),
		])
		await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
		await screen.findByRole('status')
		expect(prepare).toHaveBeenCalledTimes(2)
		const report = sent(api)
		expect(report.images).toHaveLength(2)
		const paths = vi.mocked(api.upload).mock.calls.map(call => call[0])
		expect(paths).toEqual(report.images)
		for (const path of paths)
			expect(path).toMatch(
				new RegExp(`^user-1/${report.id}/[0-9a-f-]{36}\\.png$`),
			)
	})

	it('shows a failed send and sends again without uploading twice', async () => {
		const submit = vi
			.fn<ReportApi['submit']>()
			.mockRejectedValueOnce(new Error('Please try again tomorrow.'))
			.mockResolvedValue(undefined)
		const api = renderPanel(fakeApi({ submit }))
		await fillBug()
		await userEvent.upload(screen.getByLabelText(/Drag screenshots here/), [
			png('a.png'),
		])
		await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Please try again tomorrow.',
		)
		expect(screen.getByLabelText('What happened instead?')).toHaveValue(
			'Nothing happens',
		)
		await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
		await screen.findByRole('status')
		expect(api.upload).toHaveBeenCalledTimes(1)
		expect(submit).toHaveBeenCalledTimes(2)
		expect(submit.mock.calls[1][0].id).toBe(submit.mock.calls[0][0].id)
	})

	it('does not send the report when a screenshot cannot be uploaded', async () => {
		const upload = vi
			.fn<ReportApi['upload']>()
			.mockRejectedValue(new Error('A screenshot could not be uploaded.'))
		const api = renderPanel(fakeApi({ upload }))
		await fillBug()
		await userEvent.upload(screen.getByLabelText(/Drag screenshots here/), [
			png('a.png'),
		])
		await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'could not be uploaded',
		)
		expect(api.submit).not.toHaveBeenCalled()
	})

	it('clears away an uploaded screenshot that is then removed', async () => {
		const submit = vi
			.fn<ReportApi['submit']>()
			.mockRejectedValueOnce(new Error('Try again.'))
			.mockResolvedValue(undefined)
		const api = renderPanel(fakeApi({ submit }))
		await fillBug()
		await userEvent.upload(screen.getByLabelText(/Drag screenshots here/), [
			png('a.png'),
		])
		await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
		await screen.findByRole('alert')
		await userEvent.click(
			screen.getByRole('button', { name: 'Remove a.png' }),
		)
		expect(api.remove).toHaveBeenCalledWith([
			vi.mocked(api.upload).mock.calls[0][0],
		])
		await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
		await screen.findByRole('status')
		expect(vi.mocked(api.submit).mock.calls[1][0].images).toEqual([])
	})

	it('cannot be sent twice while it is sending', async () => {
		let finish: () => void = () => undefined
		const api = renderPanel(
			fakeApi({
				submit: vi.fn(
					() =>
						new Promise<void>(resolve => {
							finish = resolve
						}),
				),
			}),
		)
		await fillBug()
		await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
		expect(
			screen.getByRole('button', { name: 'Submitting…' }),
		).toBeDisabled()
		finish()
		await screen.findByRole('status')
		expect(api.submit).toHaveBeenCalledTimes(1)
	})
})

describe('suggestion', () => {
	async function openSuggestion() {
		await userEvent.click(
			screen.getByRole('tab', { name: 'Make a Suggestion' }),
		)
	}

	it('offers the categories, starting blank', async () => {
		renderPanel()
		await openSuggestion()
		const select = screen.getByLabelText('Category')
		expect(select).toHaveValue('')
		expect(
			within(select)
				.getAllByRole('option')
				.map(option => option.textContent),
		).toEqual([
			'Choose one…',
			'Puzzles',
			'Shapes',
			'Palettes',
			'Zen Mode',
			'General/Other',
		])
	})

	it('sends the category and the suggestion', async () => {
		const api = renderPanel()
		await openSuggestion()
		await userEvent.selectOptions(
			screen.getByLabelText('Category'),
			'Zen Mode',
		)
		await userEvent.type(
			screen.getByLabelText('Your suggestion'),
			'More symmetry options',
		)
		await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
		expect(await screen.findByRole('status')).toHaveTextContent(
			'Thank you! Your suggestion was sent.',
		)
		expect(sent(api)).toMatchObject({
			kind: 'suggestion',
			roundId: 'round-1',
			feature: 'Zen Mode',
			details: 'More symmetry options',
			images: [],
		})
	})

	it('needs a category and some text', async () => {
		const api = renderPanel()
		await openSuggestion()
		await userEvent.type(screen.getByLabelText('Your suggestion'), '   ')
		await userEvent.selectOptions(
			screen.getByLabelText('Category'),
			'Shapes',
		)
		await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
		expect(screen.getByRole('alert')).toHaveTextContent('choose a category')
		expect(api.submit).not.toHaveBeenCalled()
	})

	it('shows a failed send and keeps what was written', async () => {
		renderPanel(
			fakeApi({
				submit: vi.fn(() => Promise.reject(new Error('Offline.'))),
			}),
		)
		await openSuggestion()
		await userEvent.selectOptions(
			screen.getByLabelText('Category'),
			'Shapes',
		)
		await userEvent.type(
			screen.getByLabelText('Your suggestion'),
			'Octagons',
		)
		await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
		expect(await screen.findByRole('alert')).toHaveTextContent('Offline.')
		expect(screen.getByLabelText('Your suggestion')).toHaveValue('Octagons')
	})
})
