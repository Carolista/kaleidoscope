import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProvider } from '@/test/renderWithProvider'
import { palettes, testContent } from '@/test/playerContent'
import type { PlayerContent, PlayerPuzzleSet } from '@/ui/content'
import { PlayerProgressContext } from '@/ui/content/PlayerProgressContext'
import { generateHexagonCells } from '@/domain/shapes/hexagon'
import { withLightness } from '@/domain/palettes'
import {
	coordinateKey,
	generatePuzzle,
	pieceCells,
	puzzleShapes,
} from '@/domain/puzzles'
import PuzzleMode from './PuzzleMode'
import styles from '@/ui/puzzle/PuzzleBoard.module.css'
import {
	dragTo,
	hitTest,
	markPuzzleIntrosSeen,
	pieceButton,
	stubPointerHitTesting,
	tileAt,
} from '@/test/puzzleInteraction'

const seed = 'ui-puzzle'
const puzzle = generatePuzzle(seed, palettes[1])
const content: PlayerContent = {
	...testContent,
	puzzleSets: [
		{
			id: 'set-one',
			name: 'Starter',
			shape: 'hexagon',
			track: 'basic',
			kind: 'core',
			puzzles: [
				{
					id: 'p1',
					name: 'One',
					difficulty: 'easy',
					palette: palettes[1],
					puzzle,
				},
				{
					id: 'p2',
					name: 'Two',
					difficulty: 'moderate',
					palette: palettes[1],
					puzzle: generatePuzzle('ui-puzzle-two', palettes[1]),
				},
			],
		},
	],
}

function renderBrowser(ui = <PuzzleMode />) {
	return renderWithProvider(ui, content)
}

// Opens the first puzzle of the only set, as a player would.
function renderPlaying() {
	const view = renderBrowser()
	fireEvent.click(screen.getByRole('button', { name: /Starter/ }))
	fireEvent.click(screen.getByRole('button', { name: /^Puzzle 1,/ }))
	return view
}
function solvePuzzle(target = puzzle) {
	for (const [index, piece] of target.pieces.entries()) {
		dragTo(
			pieceButton(index),
			tileAt(coordinateKey(target.solution[piece.id])),
		)
	}
}

function targetColors() {
	return [
		...screen
			.getByRole('img', { name: 'Target design' })
			.querySelectorAll('polygon'),
	].map(cell => cell.getAttribute('fill'))
}

describe('PuzzleMode', () => {
	it.each(['Delete', 'Backspace'])(
		'returns a focused board piece with %s',
		key => {
			renderPlaying()
			const destination = tileAt(
				coordinateKey(puzzle.solution[puzzle.pieces[0].id]),
			)
			dragTo(pieceButton(0), destination)
			fireEvent.keyDown(destination, { key })
			expect(pieceButton(0)).toHaveAccessibleName(/in tray/)
		},
	)

	it('keeps the target grid toggle with the other action icons', () => {
		renderPlaying()
		const toggle = screen.getByRole('button', {
			name: 'Grid lines on the target',
		})
		expect(toggle.parentElement).toBe(
			screen.getByRole('button', { name: 'Restart' }).parentElement,
		)
		const cell = () =>
			screen
				.getByRole('img', { name: 'Target design' })
				.querySelector('polygon')!
		expect(cell().style.stroke).toBe('')
		fireEvent.click(toggle)
		expect(toggle).toHaveAttribute('aria-pressed', 'false')
		expect(cell().style.stroke).not.toBe('')
		fireEvent.click(toggle)
		localStorage.removeItem('kaleidoscope:puzzle:targetGridLines')
	})

	it("tints the session's icons from the puzzle's palette, not the zen palette", () => {
		renderPlaying()
		for (const name of [
			'Restart',
			'Back to puzzle set',
			'Grid lines on the target',
		]) {
			expect(
				screen
					.getByRole('button', { name })
					.querySelector('svg')
					?.style.getPropertyValue('--fa-secondary-color'),
			).toBe(withLightness(palettes[1].colors[1], 50))
		}
	})

	it('keeps Next puzzle in place, disabled until the puzzle is solved', async () => {
		const user = userEvent.setup()
		renderPlaying()
		expect(
			screen.getByRole('button', { name: 'Next puzzle' }),
		).toBeDisabled()
		solvePuzzle()
		const next = screen.getByRole('button', { name: 'Next puzzle' })
		expect(next).toBeEnabled()
		await user.click(next)
		expect(
			screen.getAllByRole('button', { name: /of 6, empty$/ }),
		).toHaveLength(6)
	})

	beforeEach(() => {
		localStorage.clear()
		markPuzzleIntrosSeen()
		// Index 0 of the celebrations, "Congrats!".
		vi.spyOn(Math, 'random').mockReturnValue(0)
	})
	afterEach(() => {
		vi.restoreAllMocks()
	})
	stubPointerHitTesting()

	it('remembers where the pieces are and puts them back after a reload', () => {
		const first = renderPlaying()
		dragTo(
			pieceButton(0),
			tileAt(coordinateKey(puzzle.solution[puzzle.pieces[0].id])),
		)
		expect(pieceButton(0)).toHaveAccessibleName(/on board/)
		first.unmount()

		renderBrowser(
			<PuzzleMode
				openRequest={{ setId: 'set-one', puzzleId: 'p1', nonce: 1 }}
			/>,
		)
		expect(pieceButton(0)).toHaveAccessibleName(/on board/)
		expect(pieceButton(1)).toHaveAccessibleName(/in tray/)
		expect(screen.getByRole('status')).toHaveTextContent(
			'Your pieces are where you left them.',
		)
	})

	it('forgets an unfinished puzzle once it is restarted or solved', async () => {
		const user = userEvent.setup()
		const view = renderPlaying()
		dragTo(
			pieceButton(0),
			tileAt(coordinateKey(puzzle.solution[puzzle.pieces[0].id])),
		)
		await user.click(screen.getByRole('button', { name: 'Restart' }))
		view.unmount()
		renderBrowser(
			<PuzzleMode
				openRequest={{ setId: 'set-one', puzzleId: 'p1', nonce: 1 }}
			/>,
		)
		expect(pieceButton(0)).toHaveAccessibleName(/in tray/)
		solvePuzzle()
		expect(
			JSON.parse(
				localStorage.getItem('kaleidoscope:puzzle-resume:guest') ??
					'{}',
			).attempts,
		).toEqual({})
	})

	it('keeps each player’s unfinished puzzles apart', () => {
		const first = renderPlaying()
		dragTo(
			pieceButton(0),
			tileAt(coordinateKey(puzzle.solution[puzzle.pieces[0].id])),
		)
		first.unmount()
		expect(
			localStorage.getItem('kaleidoscope:puzzle-resume:guest'),
		).not.toBeNull()
		expect(
			localStorage.getItem('kaleidoscope:puzzle-resume:user-1'),
		).toBeNull()
	})

	it('lists the available sets with their progress and opens one as a numbered grid', async () => {
		const user = userEvent.setup()
		localStorage.setItem(
			'kaleidoscope:puzzle-progress',
			JSON.stringify({ version: 1, solved: ['p2', 'gone'] }),
		)
		renderBrowser()
		expect(
			screen.getByRole('heading', { name: 'Puzzle Sets' }),
		).toBeInTheDocument()
		const set = screen.getByRole('button', { name: /Starter/ })
		expect(set).toHaveTextContent('Basic')
		expect(set).toHaveTextContent('1 of 2')
		// No shape name or wording, just a preview and progress per difficulty.
		expect(set).not.toHaveTextContent(/Hexagon|solved/)
		expect(set.querySelectorAll('svg')).toHaveLength(2)
		expect(set).toHaveTextContent('0 of 1')
		expect(set).toHaveTextContent('1 of 1')
		await user.click(set)
		expect(screen.getByRole('heading', { name: 'Starter' })).toBeVisible()
		expect(
			screen
				.getAllByRole('heading', { level: 3 })
				.map(item => item.textContent),
		).toEqual(['Easy', 'Moderate'])
		expect(
			screen.getByRole('button', { name: 'Puzzle 1, Easy' }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Puzzle 2, Moderate, solved' }),
		).toBeInTheDocument()
		await user.click(
			screen.getByRole('button', { name: 'All puzzle sets' }),
		)
		expect(
			screen.getByRole('heading', { name: 'Puzzle Sets' }),
		).toBeInTheDocument()
	})

	it('says so when nothing has been released', () => {
		renderWithProvider(<PuzzleMode />, { ...testContent, puzzleSets: [] })
		expect(
			screen.getByText(/No puzzles are available yet/),
		).toBeInTheDocument()
	})

	it('remembers a solved puzzle on this device and marks it in the grid', async () => {
		const user = userEvent.setup()
		const view = renderPlaying()
		solvePuzzle()
		expect(
			JSON.parse(
				localStorage.getItem('kaleidoscope:puzzle-progress') ?? '{}',
			),
		).toEqual({ version: 1, solved: ['p1'] })
		await user.click(
			screen.getByRole('button', { name: 'Back to puzzle set' }),
		)
		expect(
			screen.getByRole('button', { name: 'Puzzle 1, Easy, solved' }),
		).toBeInTheDocument()
		view.unmount()
		renderBrowser()
		expect(
			screen.getByRole('button', { name: /Starter/ }),
		).toHaveTextContent('1 of 2')
	})

	it('finishes the set when no unsolved puzzle is left', async () => {
		const user = userEvent.setup()
		localStorage.setItem(
			'kaleidoscope:puzzle-progress',
			JSON.stringify({ version: 1, solved: ['p2'] }),
		)
		renderPlaying()
		solvePuzzle()
		expect(screen.getByRole('status')).toHaveTextContent('Puzzle solved!')
		expect(
			screen.queryByRole('button', { name: 'Next puzzle' }),
		).not.toBeInTheDocument()
		await user.click(
			screen.getByRole('button', { name: 'Back to puzzle set' }),
		)
		expect(screen.getByRole('heading', { name: 'Starter' })).toBeVisible()
	})

	it('hides a bonus set until its core set is complete, then announces and lists it', async () => {
		const user = userEvent.setup()
		const bonusContent: PlayerContent = {
			...content,
			puzzleSets: [
				...content.puzzleSets,
				{
					id: 'set-bonus',
					name: 'Extra',
					shape: 'hexagon',
					track: 'basic',
					kind: 'bonus',
					puzzles: [
						{
							id: 'bonus-1',
							name: 'Bonus',
							difficulty: 'easy',
							palette: palettes[1],
							puzzle: generatePuzzle('ui-bonus', palettes[1]),
						},
					],
				},
			],
			rewards: [
				{
					setId: 'set-one',
					palettes: [
						{ ...palettes[5], id: 'earned', name: 'Earned' },
					],
					bonusSetIds: ['set-bonus'],
				},
			],
		}
		localStorage.setItem(
			'kaleidoscope:puzzle-progress',
			JSON.stringify({ version: 1, solved: ['p2'] }),
		)
		renderWithProvider(<PuzzleMode />, bonusContent)
		expect(
			screen.queryByRole('button', { name: /Extra/ }),
		).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: /Starter/ }))
		fireEvent.click(screen.getByRole('button', { name: /^Puzzle 1,/ }))
		solvePuzzle()
		const reward = await screen.findByRole('dialog', {
			name: 'Reward earned',
		})
		expect(reward).toHaveTextContent('Hooray!')
		expect(reward).toHaveTextContent('New palette unlocked')
		expect(reward).toHaveTextContent('Earned')
		expect(reward).toHaveTextContent('New puzzle set unlocked')
		expect(reward).toHaveTextContent('Extra')
		await user.click(
			screen.getByRole('button', { name: 'Go to puzzle set now!' }),
		)
		expect(screen.getByRole('heading', { name: 'Extra' })).toBeVisible()
		await user.click(
			screen.getByRole('button', { name: 'All puzzle sets' }),
		)
		expect(screen.getByRole('button', { name: /Extra/ })).toHaveTextContent(
			'Basic bonus',
		)
	})

	it('continues through the bonus set it just opened with Next puzzle', async () => {
		const user = userEvent.setup()
		const first = generatePuzzle('ui-bonus-one', palettes[1])
		const second = generatePuzzle('ui-bonus-two', palettes[1])
		const bonusPuzzle = (id: string, target: typeof puzzle) => ({
			id,
			name: id,
			difficulty: 'easy' as const,
			palette: palettes[1],
			puzzle: target,
		})
		localStorage.setItem(
			'kaleidoscope:puzzle-progress',
			JSON.stringify({ version: 1, solved: ['p2'] }),
		)
		renderWithProvider(<PuzzleMode />, {
			...content,
			puzzleSets: [
				...content.puzzleSets,
				{
					id: 'set-bonus',
					name: 'Extra',
					shape: 'hexagon',
					track: 'basic',
					kind: 'bonus',
					puzzles: [
						bonusPuzzle('bonus-1', first),
						bonusPuzzle('bonus-2', second),
					],
				},
			],
			rewards: [
				{ setId: 'set-one', palettes: [], bonusSetIds: ['set-bonus'] },
			],
		})
		fireEvent.click(screen.getByRole('button', { name: /Starter/ }))
		fireEvent.click(screen.getByRole('button', { name: /^Puzzle 1,/ }))
		solvePuzzle()
		await user.click(
			await screen.findByRole('button', {
				name: 'Go to puzzle set now!',
			}),
		)
		expect(screen.getByRole('heading', { name: 'Extra' })).toBeVisible()
		fireEvent.click(screen.getByRole('button', { name: /^Puzzle 1,/ }))
		solvePuzzle(first)
		await user.click(screen.getByRole('button', { name: 'Next puzzle' }))
		expect(targetColors()).toEqual(
			generateHexagonCells(second.gridSize).map(
				cell => second.target[cell.groupId],
			),
		)
	})

	it('sends the player to Zen Mode from a palette reward', async () => {
		const user = userEvent.setup()
		const onOpenZen = vi.fn()
		localStorage.setItem(
			'kaleidoscope:puzzle-progress',
			JSON.stringify({ version: 1, solved: ['p2'] }),
		)
		renderWithProvider(<PuzzleMode onOpenZen={onOpenZen} />, {
			...content,
			rewards: [
				{
					setId: 'set-one',
					palettes: [
						{ ...palettes[5], id: 'earned', name: 'Earned' },
					],
					bonusSetIds: [],
				},
			],
		})
		fireEvent.click(screen.getByRole('button', { name: /Starter/ }))
		fireEvent.click(screen.getByRole('button', { name: /^Puzzle 1,/ }))
		solvePuzzle()
		const tryInZen = await screen.findByRole('button', {
			name: 'Try it out in Zen Mode now!',
		})
		expect(
			screen.queryByText('New puzzle set unlocked'),
		).not.toBeInTheDocument()
		await user.click(tryInZen)
		expect(onOpenZen).toHaveBeenCalledOnce()
	})

	it('announces an unlocked shape and its core sets after the reward dialog closes', async () => {
		const user = userEvent.setup()
		const onOpenZen = vi.fn()
		const triangleSet: PlayerPuzzleSet = {
			...content.puzzleSets[0],
			id: 'tri-core',
			name: 'Triangle basics',
			shape: 'triangle',
		}
		const markSolved = vi.fn(() =>
			Promise.resolve({
				palettes: [{ ...palettes[5], id: 'earned', name: 'Earned' }],
				bonusSets: [],
				shapes: [{ shape: 'triangle' as const, sets: [triangleSet] }],
				accountShape: null,
				randomizer: false,
			}),
		)
		renderWithProvider(
			<PlayerProgressContext.Provider
				value={{
					solved: new Set(['p2']),
					markSolved,
					guestImport: null,
				}}
			>
				<PuzzleMode onOpenZen={onOpenZen} />
			</PlayerProgressContext.Provider>,
			content,
		)
		fireEvent.click(screen.getByRole('button', { name: /Starter/ }))
		fireEvent.click(screen.getByRole('button', { name: /^Puzzle 1,/ }))
		solvePuzzle()
		await user.click(
			await screen.findByRole('button', { name: 'Close reward' }),
		)
		const announcement = await screen.findByRole('dialog', {
			name: 'New shape unlocked',
		})
		expect(announcement).toHaveTextContent(
			'Triangle is now unlocked in Zen Mode!',
		)
		expect(announcement).toHaveTextContent('Triangle basics')
		await user.click(
			screen.getByRole('button', { name: 'Try it out in Zen Mode now!' }),
		)
		expect(onOpenZen).toHaveBeenCalledOnce()
	})

	it('announces the randomizer last, after the other rewards, and sends the player to Zen', async () => {
		const user = userEvent.setup()
		const onOpenZen = vi.fn()
		const markSolved = vi.fn(() =>
			Promise.resolve({
				palettes: [{ ...palettes[5], id: 'earned', name: 'Earned' }],
				bonusSets: [],
				shapes: [],
				accountShape: null,
				randomizer: true,
			}),
		)
		renderWithProvider(
			<PlayerProgressContext.Provider
				value={{
					solved: new Set(['p2']),
					markSolved,
					guestImport: null,
				}}
			>
				<PuzzleMode onOpenZen={onOpenZen} />
			</PlayerProgressContext.Provider>,
			content,
		)
		fireEvent.click(screen.getByRole('button', { name: /Starter/ }))
		fireEvent.click(screen.getByRole('button', { name: /^Puzzle 1,/ }))
		solvePuzzle()
		await screen.findByRole('dialog', { name: 'Reward earned' })
		await user.click(screen.getByRole('button', { name: 'Close reward' }))
		const special = await screen.findByRole('dialog', {
			name: 'A very special reward',
		})
		expect(special).toHaveTextContent('all 24 puzzle sets of 24 puzzles')
		await user.click(
			screen.getByRole('button', { name: 'Try it out in Zen Mode now!' }),
		)
		expect(onOpenZen).toHaveBeenCalledOnce()
	})

	describe('account prompt for a guest who has finished everything', () => {
		function renderFinishing(
			onCreateAccount?: () => void,
			options: {
				returningGuest?: boolean
				accountShape?: 'triangle' | null
			} = {},
		) {
			const markSolved = vi.fn(() =>
				Promise.resolve({
					palettes: [],
					bonusSets: [],
					shapes: [],
					randomizer: false,
					accountShape:
						options.accountShape === undefined
							? ('triangle' as const)
							: options.accountShape,
				}),
			)
			renderWithProvider(
				<PlayerProgressContext.Provider
					value={{
						solved: new Set(['p2']),
						markSolved,
						guestImport: null,
					}}
				>
					<PuzzleMode
						onCreateAccount={onCreateAccount}
						returningGuest={options.returningGuest}
					/>
				</PlayerProgressContext.Provider>,
				content,
			)
			fireEvent.click(screen.getByRole('button', { name: /Starter/ }))
			fireEvent.click(screen.getByRole('button', { name: /^Puzzle 1,/ }))
			solvePuzzle()
		}

		it('offers an account once, and opens sign-in from it', async () => {
			const user = userEvent.setup()
			const onCreateAccount = vi.fn()
			renderFinishing(onCreateAccount)
			const prompt = await screen.findByRole('dialog', {
				name: 'Ready for more?',
			})
			expect(prompt).toHaveTextContent('unlock Triangle')
			expect(localStorage.getItem('kaleidoscope:account-prompt')).toBe(
				'seen',
			)
			await user.click(
				screen.getByRole('button', {
					name: 'Sign in or create an account',
				}),
			)
			expect(onCreateAccount).toHaveBeenCalledOnce()
		})

		it('can be dismissed to keep playing as a guest', async () => {
			const user = userEvent.setup()
			const onCreateAccount = vi.fn()
			renderFinishing(onCreateAccount)
			await user.click(
				await screen.findByRole('button', {
					name: 'Keep playing as a guest',
				}),
			)
			await waitFor(() =>
				expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
			)
			expect(onCreateAccount).not.toHaveBeenCalled()
		})

		it('is not offered again, nor where accounts cannot be created', async () => {
			localStorage.setItem('kaleidoscope:account-prompt', 'seen')
			renderFinishing(vi.fn())
			await new Promise(resolve => setTimeout(resolve, 20))
			expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
		})

		describe('sign-in reminder for a returning guest', () => {
			beforeEach(() => sessionStorage.clear())

			it('asks them to sign in, and opens sign-in from it', async () => {
				const user = userEvent.setup()
				const onSignIn = vi.fn()
				renderFinishing(onSignIn, {
					returningGuest: true,
					accountShape: null,
				})
				const nudge = await screen.findByRole('dialog', {
					name: 'Playing as a guest',
				})
				expect(nudge).toHaveTextContent(
					'Please sign in to continue saving your progress.',
				)
				expect(
					sessionStorage.getItem('kaleidoscope:sign-in-nudge'),
				).toBe('shown')
				await user.click(
					screen.getByRole('button', { name: 'Sign in' }),
				)
				expect(onSignIn).toHaveBeenCalledOnce()
			})

			it('shows once per browser session', async () => {
				sessionStorage.setItem('kaleidoscope:sign-in-nudge', 'shown')
				renderFinishing(vi.fn(), {
					returningGuest: true,
					accountShape: null,
				})
				await new Promise(resolve => setTimeout(resolve, 20))
				expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
			})

			it('is not shown to a guest who has never had an account', async () => {
				renderFinishing(vi.fn(), { accountShape: null })
				await new Promise(resolve => setTimeout(resolve, 20))
				expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
			})

			it('does not repeat the account prompt', async () => {
				renderFinishing(vi.fn(), { returningGuest: true })
				expect(
					await screen.findByRole('dialog', {
						name: 'Ready for more?',
					}),
				).toBeInTheDocument()
				expect(
					sessionStorage.getItem('kaleidoscope:sign-in-nudge'),
				).toBeNull()
			})
		})

		it('is not offered without a way to create an account', async () => {
			renderFinishing()
			await new Promise(resolve => setTimeout(resolve, 20))
			expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
		})
	})

	it('moves to the next puzzle in the set without repeating a solved one', async () => {
		const user = userEvent.setup()
		renderPlaying()
		solvePuzzle()
		await user.click(screen.getByRole('button', { name: 'Next puzzle' }))
		expect(
			screen.getAllByRole('button', { name: /of 6, empty$/ }),
		).toHaveLength(6)
		expect(targetColors()).toEqual(
			generateHexagonCells(
				content.puzzleSets[0].puzzles[1].puzzle.gridSize,
			).map(
				cell =>
					content.puzzleSets[0].puzzles[1].puzzle.target[
						cell.groupId
					],
			),
		)
	})

	it('shows the target, six blank wedge tiles, and three fixed-orientation pieces', () => {
		renderPlaying()
		expect(
			screen.getByRole('img', { name: 'Target design' }),
		).toBeInTheDocument()
		expect(
			screen.getAllByRole('button', {
				name: /^Puzzle tile \d of 6, empty$/,
			}),
		).toHaveLength(6)
		expect(
			screen.getAllByRole('button', { name: /^Select piece/ }),
		).toHaveLength(3)
		expect(screen.queryByRole('heading')).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'Return selected piece' }),
		).not.toBeInTheDocument()
		const tray = screen.getByRole('group', { name: 'Puzzle pieces' })
		expect(tray).toHaveTextContent('')
		expect(tray.querySelectorAll('span, small')).toHaveLength(0)
		expect(screen.getByRole('status')).toHaveClass('visually-hidden')
		const actions = screen.getByRole('button', {
			name: 'Restart',
		}).parentElement!
		expect(actions.querySelector('button')).toHaveAccessibleName(
			'Back to puzzle set',
		)
		for (const svg of tray.querySelectorAll('svg')) {
			const [, , width, height] = svg
				.getAttribute('viewBox')!
				.split(' ')
				.map(Number)
			expect(svg).toHaveStyle({
				width: `${width}px`,
				height: `${height}px`,
			})
		}
		expect(screen.queryByText(/POC · Seed:/)).not.toBeInTheDocument()
		expect(
			screen
				.getByRole('group', { name: 'Puzzle pieces' })
				.querySelector('circle'),
		).not.toBeInTheDocument()
		expect(
			screen
				.getByRole('group', { name: 'Puzzle board' })
				.querySelectorAll(`.${styles.mutedMirrorCell}`),
		).toHaveLength(31)
	})

	it('solves by keyboard selection/placement and mirrors every placed tile', async () => {
		const user = userEvent.setup()
		renderPlaying()
		const board = screen.getByRole('group', { name: 'Puzzle board' })
		const wedgeTiles = Object.fromEntries(
			Object.keys(puzzle.target).map(key => [key, tileAt(key)]),
		)
		for (const [index, piece] of puzzle.pieces.entries()) {
			pieceButton(index).focus()
			await user.keyboard('{Enter}')
			const anchor = puzzle.solution[piece.id]
			tileAt(coordinateKey(anchor)).focus()
			await user.keyboard(' ')
			for (const cell of pieceCells(piece, anchor)) {
				expect(wedgeTiles[coordinateKey(cell)]).toHaveAttribute(
					'fill',
					cell.color,
				)
			}
		}
		expect(screen.getByRole('status')).toHaveTextContent('Puzzle solved!')
		expect(screen.getByText('Congrats!')).toHaveAttribute(
			'aria-hidden',
			'true',
		)
		for (const [group, color] of Object.entries(puzzle.target)) {
			expect(wedgeTiles[group]).toHaveAttribute('fill', color)
		}
		expect(
			board.querySelectorAll('polygon[fill="var(--accent)"]'),
		).toHaveLength(0)
		expect(
			board.querySelectorAll(`.${styles.mutedMirrorCell}`),
		).toHaveLength(0)
		expect(board.querySelectorAll('[data-piece-outline]')).toHaveLength(0)
		expect(board.querySelectorAll(`.${styles.wedgeCell}`)).toHaveLength(0)
		expect(
			board.querySelectorAll('[role="button"], [tabindex]'),
		).toHaveLength(0)
		const completedColors = [...board.querySelectorAll('polygon')].map(
			cell => cell.getAttribute('fill'),
		)
		const tile = wedgeTiles[Object.keys(puzzle.target)[0]]
		await user.click(tile)
		fireEvent.keyDown(tile, { key: 'Enter' })
		dragTo(tile, screen.getByRole('group', { name: 'Puzzle pieces' }))
		expect(
			document.querySelector(`.${styles.draggedPiece}`),
		).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'Return selected piece' }),
		).not.toBeInTheDocument()
		expect(
			[...board.querySelectorAll('polygon')].map(cell =>
				cell.getAttribute('fill'),
			),
		).toEqual(completedColors)
		expect(screen.getByRole('status')).toHaveTextContent('Puzzle solved!')
		await user.click(screen.getByRole('button', { name: 'Restart' }))
		expect(
			board.querySelectorAll(`.${styles.mutedMirrorCell}`),
		).toHaveLength(31)
		expect(board.querySelectorAll('[role="button"]')).toHaveLength(6)
	})

	it('shows a brief Congrats over the solved puzzle without a dialog, then starts a new blank puzzle', async () => {
		const user = userEvent.setup()
		renderPlaying()
		expect(screen.queryByText('Congrats!')).not.toBeInTheDocument()
		solvePuzzle()
		expect(screen.getByText('Congrats!')).toBeInTheDocument()
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
		expect(targetColors()).toEqual(
			[
				...screen
					.getByRole('group', { name: 'Puzzle board' })
					.querySelectorAll('polygon'),
			].map(cell => cell.getAttribute('fill')),
		)
		await user.click(screen.getByRole('button', { name: 'Next puzzle' }))
		expect(screen.queryByText('Congrats!')).not.toBeInTheDocument()
		expect(
			screen.getAllByRole('button', { name: /of 6, empty$/ }),
		).toHaveLength(6)
	})

	it('accepts a fitting wrong placement, lets it be returned, and restarts', async () => {
		const user = userEvent.setup()
		renderPlaying()
		const singleIndex = puzzle.pieces.findIndex(
			piece => piece.tiles.length === 1,
		)
		const other = puzzle.pieces.find(piece => piece.tiles.length > 1)!
		await user.click(pieceButton(singleIndex))
		await user.click(tileAt(coordinateKey(puzzle.solution[other.id])))
		expect(pieceButton(singleIndex)).toHaveAccessibleName(/on board/)
		expect(screen.getByRole('status')).not.toHaveTextContent('solved')
		dragTo(
			tileAt(coordinateKey(puzzle.solution[other.id])),
			screen.getByRole('group', { name: 'Puzzle pieces' }),
		)
		expect(pieceButton(singleIndex)).toHaveAccessibleName(/in tray/)
		expect(pieceButton(singleIndex)).toBeEnabled()
		await user.click(pieceButton(singleIndex))
		await user.click(tileAt(coordinateKey(puzzle.solution[other.id])))
		await user.click(screen.getByRole('button', { name: 'Restart' }))
		expect(
			screen.getAllByRole('button', { name: /of 6, empty$/ }),
		).toHaveLength(6)
		expect(targetColors()).toEqual(
			// Restart preserves the original puzzle rather than generating another.
			generateHexagonCells(puzzle.gridSize).map(
				cell => puzzle.target[cell.groupId],
			),
		)
	})

	it.each(['mouse', 'touch'])(
		'supports dragging with %s, previews the drop, and returns pieces to the tray',
		pointerType => {
			renderPlaying()
			const piece = puzzle.pieces[0]
			const destination = tileAt(coordinateKey(puzzle.solution[piece.id]))
			dragTo(pieceButton(0), destination, pointerType)
			expect(pieceButton(0)).toHaveAccessibleName(/on board/)
			expect(destination).toHaveAttribute('fill', piece.tiles[0].color)
			dragTo(
				destination,
				screen.getByRole('group', { name: 'Puzzle pieces' }),
				pointerType,
			)
			expect(pieceButton(0)).toHaveAccessibleName(/in tray/)
			expect(destination).toHaveAttribute('fill', 'var(--accent)')
		},
	)

	it('keeps an existing placement after an invalid drop or pointer cancellation', () => {
		renderPlaying()
		const piece = puzzle.pieces[0]
		const destination = tileAt(coordinateKey(puzzle.solution[piece.id]))
		dragTo(pieceButton(0), destination)
		dragTo(destination, null)
		expect(screen.getByRole('status')).toHaveTextContent(
			'Drop onto a wedge tile',
		)
		expect(destination).toHaveAttribute('fill', piece.tiles[0].color)
		fireEvent.pointerDown(destination, {
			pointerId: 1,
			button: 0,
			clientX: 10,
			clientY: 10,
		})
		fireEvent.pointerCancel(destination, { pointerId: 1 })
		expect(screen.getByRole('status')).toHaveTextContent('Drag cancelled')
		expect(destination).toHaveAttribute('fill', piece.tiles[0].color)
	})

	it('rejects overlapping and outside-wedge placements with explicit feedback', async () => {
		const user = userEvent.setup()
		renderPlaying()
		const singleIndex = puzzle.pieces.findIndex(
			piece => piece.tiles.length === 1,
		)
		const multiIndex = puzzle.pieces.findIndex(
			piece => piece.tiles.length > 1,
		)
		const multi = puzzle.pieces[multiIndex]
		const anchor = tileAt(coordinateKey(puzzle.solution[multi.id]))
		await user.click(pieceButton(multiIndex))
		await user.click(anchor)
		await user.click(pieceButton(singleIndex))
		await user.click(anchor)
		expect(screen.getByRole('status')).toHaveTextContent(
			'overlaps another piece',
		)
		expect(pieceButton(singleIndex)).toHaveAccessibleName(/in tray/)
		await user.click(screen.getByRole('button', { name: 'Restart' }))
		await user.click(pieceButton(multiIndex))
		await user.click(anchor)
		const outsideAnchor = Object.keys(puzzle.target).find(key => {
			const [q, r] = key.split(',').map(Number)
			return pieceCells(multi, { q, r }).some(
				tile => !Object.hasOwn(puzzle.target, coordinateKey(tile)),
			)
		})!
		await user.click(anchor)
		await user.click(tileAt(outsideAnchor))
		expect(screen.getByRole('status')).toHaveTextContent(
			'inside the outlined wedge',
		)
		expect(anchor).toHaveAttribute('fill', multi.tiles[0].color)
	})

	it('disables placed tray pieces and outlines connected pieces without internal edges', async () => {
		const user = userEvent.setup()
		renderPlaying()
		const index = puzzle.pieces.findIndex(piece => piece.tiles.length === 2)
		const piece = puzzle.pieces[index]
		const anchor = tileAt(coordinateKey(puzzle.solution[piece.id]))
		await user.click(pieceButton(index))
		await user.click(anchor)
		expect(pieceButton(index)).toBeDisabled()
		expect(screen.queryByText('On board')).not.toBeInTheDocument()
		await user.click(pieceButton(index))
		expect(
			screen.queryByRole('button', { name: 'Return selected piece' }),
		).not.toBeInTheDocument()
		fireEvent.pointerDown(pieceButton(index), { pointerId: 1, button: 0 })
		hitTest.mockReturnValue(
			screen.getByRole('group', { name: 'Puzzle pieces' }),
		)
		fireEvent.pointerUp(pieceButton(index), {
			pointerId: 1,
			clientX: 100,
			clientY: 100,
		})
		expect(anchor).toHaveAttribute('fill', piece.tiles[0].color)
		const board = screen.getByRole('group', { name: 'Puzzle board' })
		const outline = board.querySelector(
			`[data-piece-outline="${piece.id}"]`,
		)!
		expect(
			outline.querySelector('path')?.getAttribute('d')?.match(/M /g),
		).toHaveLength(10)
		await user.click(anchor)
		expect(anchor).toHaveAttribute('aria-pressed', 'true')
		expect(anchor).toHaveAccessibleDescription(
			`Piece ${index + 1}. Double-click or double-tap to return to tray; keyboard: Delete or Backspace.`,
		)
		expect(outline).toHaveClass(styles.selectedOutline)
		dragTo(anchor, screen.getByRole('group', { name: 'Puzzle pieces' }))
		expect(pieceButton(index)).toBeEnabled()
		expect(
			board.querySelector('[data-piece-outline]'),
		).not.toBeInTheDocument()
	})

	it('moves the selection to another placed piece when it is clicked', async () => {
		const user = userEvent.setup()
		renderPlaying()
		const [first, second] = puzzle.pieces
		for (const [index, piece] of [first, second].entries())
			dragTo(
				pieceButton(index),
				tileAt(coordinateKey(puzzle.solution[piece.id])),
			)
		const board = screen.getByRole('group', { name: 'Puzzle board' })
		const outlineOf = (id: string) =>
			board.querySelector(`[data-piece-outline="${id}"]`)
		await user.click(tileAt(coordinateKey(puzzle.solution[first.id])))
		expect(outlineOf(first.id)).toHaveClass(styles.selectedOutline)
		await user.click(tileAt(coordinateKey(puzzle.solution[second.id])))
		expect(outlineOf(second.id)).toHaveClass(styles.selectedOutline)
		expect(outlineOf(first.id)).not.toHaveClass(styles.selectedOutline)
	})

	it('draws the selected piece outline above the other pieces', async () => {
		const user = userEvent.setup()
		renderPlaying()
		const [first, second] = puzzle.pieces
		for (const [index, piece] of [first, second].entries())
			dragTo(
				pieceButton(index),
				tileAt(coordinateKey(puzzle.solution[piece.id])),
			)
		const board = screen.getByRole('group', { name: 'Puzzle board' })
		await user.click(tileAt(coordinateKey(puzzle.solution[first.id])))
		const drawn = [...board.querySelectorAll('[data-piece-outline]')]
		expect(drawn.at(-1)).toHaveAttribute('data-piece-outline', first.id)
	})

	it('preserves the grabbed tile offset when dragging a placed multi-tile piece', () => {
		renderPlaying()
		const index = puzzle.pieces.findIndex(piece => piece.tiles.length > 1)
		const piece = puzzle.pieces[index]
		const anchor = puzzle.solution[piece.id]
		dragTo(pieceButton(index), tileAt(coordinateKey(anchor)))
		const otherTile = pieceCells(piece, anchor)[1]
		const source = tileAt(coordinateKey(otherTile))
		dragTo(source, source)
		expect(pieceButton(index)).toHaveAccessibleName(/on board/)
		for (const cell of pieceCells(piece, anchor)) {
			expect(tileAt(coordinateKey(cell))).toHaveAttribute(
				'fill',
				cell.color,
			)
		}
	})

	it('drags an opaque piece at board scale, snapping to its board position over a wedge tile', () => {
		renderPlaying()
		const piece = puzzle.pieces[0]
		const source = pieceButton(0)
		const board = screen.getByRole('group', { name: 'Puzzle board' })
		Object.defineProperty(board, 'getScreenCTM', {
			value: () => ({ a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 }),
		})
		const destination = tileAt(coordinateKey(puzzle.solution[piece.id]))
		// The hexagon board draws tiles at 16 units; the first tile is the grab point.
		const snapped = puzzleShapes.hexagon.center(
			puzzle.solution[piece.id],
			16,
		)
		hitTest.mockReturnValue(destination)
		fireEvent.pointerDown(source, {
			pointerId: 1,
			button: 0,
			clientX: 10,
			clientY: 10,
		})
		fireEvent.pointerMove(source, {
			pointerId: 1,
			clientX: 2 * snapped.x + 3,
			clientY: 2 * snapped.y - 3,
		})
		expect(board.querySelectorAll('polygon')).toHaveLength(37)
		const graphic = document.querySelector(`.${styles.draggedPiece}`)!
		// The box is centered on the grabbed tile, in board units and on screen.
		const heldCenter = () => {
			const [x, y, size] = graphic
				.getAttribute('viewBox')!
				.split(' ')
				.map(Number)
			const style = (graphic as SVGElement).style
			const width = parseFloat(style.width)
			return {
				board: { x: x + size / 2, y: y + size / 2 },
				screen: {
					x: parseFloat(style.left) + width / 2,
					y: parseFloat(style.top) + width / 2,
				},
				// Screen pixels per board unit.
				scale: width / size,
			}
		}
		expect(heldCenter().board.x).toBeCloseTo(snapped.x, 6)
		expect(heldCenter().board.y).toBeCloseTo(snapped.y, 6)
		expect(heldCenter().screen.x).toBeCloseTo(2 * snapped.x, 6)
		expect(heldCenter().screen.y).toBeCloseTo(2 * snapped.y, 6)
		expect(heldCenter().scale).toBeCloseTo(2, 6)
		expect(graphic).not.toHaveClass(styles.floatingPiece)
		expect(graphic.querySelectorAll('polygon')).toHaveLength(
			piece.tiles.length,
		)
		expect(destination).toHaveAttribute('fill', 'var(--accent)')
		hitTest.mockReturnValue(null)
		fireEvent.pointerMove(source, {
			pointerId: 1,
			clientX: 150,
			clientY: 200,
		})
		expect(heldCenter().screen).toEqual({ x: 150, y: 200 })
		expect(graphic).toHaveClass(styles.floatingPiece)
		hitTest.mockReturnValue(destination)
		fireEvent.pointerUp(source, {
			pointerId: 2,
			clientX: 100,
			clientY: 100,
		})
		fireEvent.pointerUp(source, {
			pointerId: 1,
			clientX: 100,
			clientY: 100,
		})
		expect(pieceButton(0)).toHaveAccessibleName(/on board/)
		expect(board.querySelectorAll('polygon')).toHaveLength(37)
		expect(
			document.querySelector(`.${styles.draggedPiece}`),
		).not.toBeInTheDocument()
	})

	it('floats over a piece that is in the way and snaps to an open spot', () => {
		renderPlaying()
		const [first, second] = puzzle.pieces
		const board = screen.getByRole('group', { name: 'Puzzle board' })
		dragTo(pieceButton(0), tileAt(coordinateKey(puzzle.solution[first.id])))
		Object.defineProperty(board, 'getScreenCTM', {
			value: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
		})
		const occupied = puzzleShapes.hexagon.center(
			puzzle.solution[first.id],
			16,
		)
		const open = puzzleShapes.hexagon.center(puzzle.solution[second.id], 16)
		hitTest.mockReturnValue(null)
		const source = pieceButton(1)
		fireEvent.pointerDown(source, {
			pointerId: 3,
			button: 0,
			clientX: 500,
			clientY: 500,
		})
		fireEvent.pointerMove(source, {
			pointerId: 3,
			clientX: occupied.x,
			clientY: occupied.y,
		})
		const graphic = document.querySelector(`.${styles.draggedPiece}`)!
		expect(graphic).toHaveClass(styles.floatingPiece)
		fireEvent.pointerMove(source, {
			pointerId: 3,
			clientX: open.x,
			clientY: open.y,
		})
		expect(graphic).not.toHaveClass(styles.floatingPiece)
		fireEvent.pointerUp(source, {
			pointerId: 3,
			clientX: open.x,
			clientY: open.y,
		})
		expect(pieceButton(1)).toHaveAccessibleName(/on board/)
	})

	it('empties the spot of a placed piece while it is lifted, and restores it if dropped nowhere', () => {
		renderPlaying()
		const destination = tileAt(
			coordinateKey(puzzle.solution[puzzle.pieces[0].id]),
		)
		dragTo(pieceButton(0), destination)
		const placedFill = destination.getAttribute('fill')
		expect(placedFill).not.toBe('var(--accent)')
		hitTest.mockReturnValue(null)
		fireEvent.pointerDown(destination, {
			pointerId: 4,
			button: 0,
			clientX: 10,
			clientY: 10,
		})
		fireEvent.pointerMove(destination, {
			pointerId: 4,
			clientX: 300,
			clientY: 300,
		})
		expect(destination).toHaveAttribute('fill', 'var(--accent)')
		fireEvent.pointerUp(destination, {
			pointerId: 4,
			clientX: 300,
			clientY: 300,
		})
		expect(destination).toHaveAttribute('fill', placedFill)
	})

	it('keeps progress while hidden and moves to the next puzzle in the set', async () => {
		const user = userEvent.setup()
		const view = renderPlaying()
		await user.click(pieceButton(0))
		await user.click(
			tileAt(coordinateKey(puzzle.solution[puzzle.pieces[0].id])),
		)
		view.rerender(<PuzzleMode hidden />)
		expect(
			screen.queryByRole('region', { name: 'Puzzle Mode' }),
		).not.toBeInTheDocument()
		view.rerender(<PuzzleMode />)
		expect(pieceButton(0)).toHaveAccessibleName(/on board/)
		await user.click(screen.getByRole('button', { name: 'Restart' }))
		solvePuzzle()
		await user.click(screen.getByRole('button', { name: 'Next puzzle' }))
		expect(
			screen.getAllByRole('button', { name: /of 6, empty$/ }),
		).toHaveLength(6)
		expect(
			screen.queryByRole('button', { name: 'Next puzzle' }),
		).not.toBeInTheDocument()
	})
})
