export interface SurveyOption {
	// What is stored, so it must stay the same for as long as answers to it are kept.
	readonly value: string
	readonly label: string
}

export type SurveyQuestion = {
	// What the answer is stored under.
	readonly id: string
	readonly label: string
	readonly required: boolean
} & (
	| { readonly kind: 'choice'; readonly options: readonly SurveyOption[] }
	| { readonly kind: 'text' }
)

export interface Survey {
	readonly intro: string
	readonly questions: readonly SurveyQuestion[]
}

// The questions testers are asked at the end of a round, by the round's `survey_version`.
// Answers are stored without the wording, so a question that changes in meaning belongs in
// a new version, and the old one stays here for as long as its answers are read.
export const SURVEYS: Readonly<Record<number, Survey>> = {
	1: {
		intro: 'Thank you for testing Kaleidoscope! Please tell us what you think now that you have tried it. You can send the survey only once.',
		questions: [
			{
				id: 'sean_ellis',
				kind: 'choice',
				label: 'How would you feel if you could no longer use Kaleidoscope?',
				required: true,
				options: [
					{ value: 'very_disappointed', label: 'Very disappointed' },
					{
						value: 'somewhat_disappointed',
						label: 'Somewhat disappointed',
					},
					{ value: 'not_disappointed', label: 'Not disappointed' },
					{ value: 'no_longer_use', label: 'I no longer use it' },
				],
			},
			{
				id: 'most_used',
				kind: 'choice',
				label: 'Which part of Kaleidoscope did you use the most?',
				required: true,
				options: [
					{ value: 'puzzle', label: 'Puzzle Mode' },
					{ value: 'zen', label: 'Zen Mode' },
					{ value: 'both', label: 'Both about equally' },
				],
			},
			{
				id: 'enjoyed',
				kind: 'text',
				label: 'What did you enjoy the most?',
				required: false,
			},
			{
				id: 'confusing',
				kind: 'text',
				label: 'What was the most confusing or frustrating part?',
				required: false,
			},
			{
				id: 'wish',
				kind: 'text',
				label: 'What is one thing you wish Kaleidoscope had that it does not?',
				required: false,
			},
			{
				id: 'other',
				kind: 'text',
				label: 'Is there anything else you would like to tell us?',
				required: false,
			},
		],
	},
}

export function surveyFor(version: number): Survey | undefined {
	return SURVEYS[version]
}

export type SurveyAnswers = Readonly<Record<string, string>>
