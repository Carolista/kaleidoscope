import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ReportApi } from './betaReports'
import { SURVEYS } from './survey'
import SurveyPanel from './SurveyPanel'

function fakeApi(
	submitSurvey: ReportApi['submitSurvey'] = () => Promise.resolve(),
) {
	return { submitSurvey: vi.fn(submitSurvey) } as unknown as ReportApi
}

function renderPanel(api: ReportApi, alreadySent = false) {
	render(
		<SurveyPanel
			survey={SURVEYS[1]}
			roundId="round-1"
			api={api}
			alreadySent={alreadySent}
		/>,
	)
}

async function openSurvey() {
	await userEvent.click(
		screen.getByRole('button', { name: 'Take the Survey' }),
	)
	return screen.getByRole('dialog', { name: 'Final Survey' })
}

async function answerRequired() {
	await userEvent.click(screen.getByLabelText('Somewhat disappointed'))
	await userEvent.click(screen.getByLabelText('Zen Mode'))
}

describe('SurveyPanel', () => {
	it('explains the survey and opens it in a dialog', async () => {
		renderPanel(fakeApi())
		expect(
			screen.getAllByText(/You can send the survey only once/),
		).not.toHaveLength(0)
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
		const dialog = await openSurvey()
		expect(
			within(dialog).getByText(/Thank you for testing/),
		).toBeInTheDocument()
	})

	it('asks every question of the survey', async () => {
		renderPanel(fakeApi())
		const dialog = await openSurvey()
		for (const question of SURVEYS[1].questions)
			expect(
				within(dialog).getByText(question.label, { exact: false }),
			).toBeInTheDocument()
		expect(within(dialog).getAllByText(/\(required\)/)).toHaveLength(2)
		expect(within(dialog).getAllByText(/\(optional\)/)).toHaveLength(4)
	})

	it('needs the required questions answered', async () => {
		const api = fakeApi()
		renderPanel(api)
		await openSurvey()
		await userEvent.click(screen.getByLabelText('Zen Mode'))
		await userEvent.type(
			screen.getByLabelText(/What did you enjoy the most/),
			'The colors',
		)
		await userEvent.click(
			screen.getByRole('button', { name: 'Send Survey' }),
		)
		expect(api.submitSurvey).not.toHaveBeenCalled()
	})

	it('sends only the questions that were answered, then thanks the tester', async () => {
		const api = fakeApi()
		renderPanel(api)
		await openSurvey()
		await answerRequired()
		await userEvent.type(
			screen.getByLabelText(
				/What was the most confusing or frustrating part/,
			),
			'  The rotate button  ',
		)
		await userEvent.type(
			screen.getByLabelText(/What did you enjoy the most/),
			'   ',
		)
		await userEvent.click(
			screen.getByRole('button', { name: 'Send Survey' }),
		)
		expect(api.submitSurvey).toHaveBeenCalledExactlyOnceWith('round-1', {
			sean_ellis: 'somewhat_disappointed',
			most_used: 'zen',
			confusing: 'The rotate button',
		})
		expect(
			await screen.findByText('Thank you! Your survey was sent.'),
		).toBeInTheDocument()
		await waitFor(() =>
			expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
		)
		expect(
			screen.queryByRole('button', { name: 'Take the Survey' }),
		).not.toBeInTheDocument()
	})

	it('shows a failed send and keeps the answers', async () => {
		const api = fakeApi(() => Promise.reject(new Error('Offline.')))
		renderPanel(api)
		await openSurvey()
		await answerRequired()
		await userEvent.type(
			screen.getByLabelText(/What did you enjoy the most/),
			'Colors',
		)
		await userEvent.click(
			screen.getByRole('button', { name: 'Send Survey' }),
		)
		expect(await screen.findByRole('alert')).toHaveTextContent('Offline.')
		expect(screen.getByLabelText('Zen Mode')).toBeChecked()
		expect(
			screen.getByLabelText(/What did you enjoy the most/),
		).toHaveValue('Colors')
		expect(
			screen.getByRole('button', { name: 'Send Survey' }),
		).toBeEnabled()
	})

	it('keeps what was answered when the dialog is closed and opened again', async () => {
		renderPanel(fakeApi())
		await openSurvey()
		await userEvent.type(
			screen.getByLabelText(/What did you enjoy the most/),
			'Colors',
		)
		await userEvent.click(
			screen.getByRole('button', { name: 'Close Final Survey' }),
		)
		await waitFor(() =>
			expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
		)
		await openSurvey()
		expect(
			screen.getByLabelText(/What did you enjoy the most/),
		).toHaveValue('Colors')
	})

	it('only thanks a tester who has already sent it', () => {
		renderPanel(fakeApi(), true)
		expect(
			screen.getByText('Thank you! Your survey was sent.'),
		).toBeInTheDocument()
		expect(screen.queryByRole('button')).not.toBeInTheDocument()
	})
})
