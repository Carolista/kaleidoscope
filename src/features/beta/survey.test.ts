import { describe, expect, it } from 'vitest'
import { SURVEYS, surveyFor } from './survey'

describe('surveys', () => {
	it('finds a survey by version, and none for an unknown one', () => {
		expect(surveyFor(1)).toBe(SURVEYS[1])
		expect(surveyFor(99)).toBeUndefined()
	})

	it.each(Object.entries(SURVEYS))(
		'version %s has unique questions and options, and choices to choose from',
		(_version, survey) => {
			const ids = survey.questions.map(question => question.id)
			expect(new Set(ids).size).toBe(ids.length)
			for (const question of survey.questions) {
				if (question.kind !== 'choice') continue
				const values = question.options.map(option => option.value)
				expect(values.length).toBeGreaterThan(1)
				expect(new Set(values).size).toBe(values.length)
			}
		},
	)

	it('asks the Sean Ellis question first and requires it, under the key the admin tallies', () => {
		const [first] = SURVEYS[1].questions
		expect(first).toMatchObject({
			id: 'sean_ellis',
			kind: 'choice',
			required: true,
		})
		expect(
			first.kind === 'choice' &&
				first.options.map(option => option.value),
		).toEqual([
			'very_disappointed',
			'somewhat_disappointed',
			'not_disappointed',
			'no_longer_use',
		])
	})
})
