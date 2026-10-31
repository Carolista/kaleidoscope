import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ReportApi, ReportRecord } from './betaReports'
import ReportHistory from './ReportHistory'

function record(overrides: Partial<ReportRecord> = {}): ReportRecord {
	return {
		id: 'r1',
		kind: 'bug',
		status: 'new',
		adminNote: null,
		createdAt: Date.parse('2026-10-31T12:00:00Z'),
		steps: 'Open Zen, tap Save',
		expected: 'An image downloads',
		happened: 'Nothing happens',
		feature: null,
		details: null,
		screenshotCount: 0,
		...overrides,
	}
}

function renderHistory(load: ReportApi['loadHistory']) {
	const api = {
		loadHistory: vi.fn(load),
	} as unknown as ReportApi
	render(<ReportHistory api={api} userId="user-1" />)
	return api
}

describe('ReportHistory', () => {
	it('asks for the signed-in tester’s reports', async () => {
		const api = renderHistory(() => Promise.resolve([]))
		expect(screen.getByRole('status')).toHaveTextContent(
			'Loading your history',
		)
		await screen.findByText(/You have not sent any feedback yet/)
		expect(api.loadHistory).toHaveBeenCalledWith('user-1')
	})

	it('lists each report with its kind, date, and status', async () => {
		renderHistory(() =>
			Promise.resolve([
				record({ id: 'a', status: 'investigating' }),
				record({
					id: 'b',
					kind: 'suggestion',
					status: 'resolved',
					feature: 'Zen Mode',
					details: 'More symmetry',
					steps: null,
					expected: null,
					happened: null,
				}),
				record({
					id: 'c',
					kind: 'other',
					details: 'Hello',
					status: 'new',
				}),
			]),
		)
		const items = await screen.findAllByRole('listitem')
		expect(items).toHaveLength(3)
		expect(within(items[0]).getByText('Bug Report')).toBeInTheDocument()
		expect(within(items[0]).getByText('Investigating')).toBeInTheDocument()
		expect(
			within(items[0]).getByText(/10\/31\/26|31\/10\/2026|2026/),
		).toBeInTheDocument()
		expect(within(items[1]).getByText('Suggestion')).toBeInTheDocument()
		expect(within(items[1]).getByText('Resolved')).toBeInTheDocument()
		expect(within(items[2]).getByText('Feedback')).toBeInTheDocument()
		expect(within(items[2]).getByText('Received')).toBeInTheDocument()
	})

	it('shows the admin’s reply, and what was sent in the words of each question', async () => {
		renderHistory(() =>
			Promise.resolve([
				record({
					adminNote: 'Fixed in the next version.',
					screenshotCount: 2,
				}),
				record({
					id: 'b',
					kind: 'suggestion',
					feature: 'Shapes',
					details: 'Octagons',
					steps: null,
					expected: null,
					happened: null,
				}),
			]),
		)
		const [bug, suggestion] = await screen.findAllByRole('listitem')
		expect(
			within(bug).getByText('Fixed in the next version.'),
		).toBeInTheDocument()
		const sent = within(bug)
		for (const label of [
			'What I expected',
			'What happened instead',
			'Steps to reproduce',
		])
			expect(sent.getByText(label)).toBeInTheDocument()
		expect(sent.getByText('Nothing happens')).toBeInTheDocument()
		expect(sent.getByText('2 screenshots attached')).toBeInTheDocument()
		expect(within(suggestion).getByText('Category')).toBeInTheDocument()
		expect(within(suggestion).getByText('Octagons')).toBeInTheDocument()
		expect(within(suggestion).queryByText('Reply:')).not.toBeInTheDocument()
		expect(
			within(suggestion).queryByText(/screenshot/),
		).not.toBeInTheDocument()
	})

	it('says one screenshot in the singular', async () => {
		renderHistory(() => Promise.resolve([record({ screenshotCount: 1 })]))
		expect(
			await screen.findByText('1 screenshot attached'),
		).toBeInTheDocument()
	})

	it('can try again after a failure', async () => {
		const load = vi
			.fn<ReportApi['loadHistory']>()
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValue([record()])
		renderHistory(load)
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'could not be loaded',
		)
		await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
		expect(await screen.findByText('Bug Report')).toBeInTheDocument()
		expect(load).toHaveBeenCalledTimes(2)
	})
})
