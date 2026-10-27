import { useId, type CSSProperties } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faPuzzlePieceSimple, faSpa } from '@fortawesome/pro-solid-svg-icons'
import { usePlayerContent } from '@/ui/content'
import styles from './HomeScreen.module.css'

interface Area {
	readonly id: 'puzzle' | 'zen'
	readonly title: string
	readonly tagline: string
	readonly icon: IconDefinition
}

// In the order they are offered. A community area joins these in a later phase.
const AREAS: readonly Area[] = [
	{
		id: 'puzzle',
		title: 'Puzzle Mode',
		tagline: 'Engage your mind with beautiful geometric puzzles.',
		icon: faPuzzlePieceSimple,
	},
	{
		id: 'zen',
		title: 'Zen Mode',
		tagline: 'Relax and create colorful kaleidoscopes.',
		icon: faSpa,
	},
]

// Diagonal bands, one per palette color.
function bands(colors: readonly string[]) {
	const step = 100 / colors.length
	const stops = colors.map(
		(color, slot) => `${color} ${slot * step}% ${(slot + 1) * step}%`,
	)
	return `linear-gradient(120deg, ${stops.join(', ')})`
}

function greeting(signedIn: boolean, name: string | null) {
	if (!signedIn) return 'Welcome!'
	return name ? `Hi, ${name}!` : 'Welcome back!'
}

// What a player sees on arriving: a greeting, then one big card per area to play in.
export default function HomeScreen({
	signedIn,
	firstName = null,
	onSignIn,
	onOpenPuzzle,
	onOpenZen,
	continuePuzzle = false,
}: {
	readonly signedIn: boolean
	readonly firstName?: string | null
	// Offered to guests only, and only where accounts are available.
	readonly onSignIn?: () => void
	readonly onOpenPuzzle: () => void
	readonly onOpenZen: () => void
	// A puzzle was left unfinished, so its card takes the player back to it.
	readonly continuePuzzle?: boolean
}) {
	const { palettes } = usePlayerContent()
	const idPrefix = useId()
	const open = { puzzle: onOpenPuzzle, zen: onOpenZen }
	return (
		<section className={styles.home} aria-label="Home">
			<div className={styles.welcome}>
				<h2 className={styles.greeting}>
					{greeting(signedIn, firstName)}
				</h2>
				{!signedIn && onSignIn && (
					<button
						type="button"
						className={styles.link}
						onClick={onSignIn}
					>
						Sign in or create an account
					</button>
				)}
			</div>
			<div className={styles.cards}>
				{AREAS.map((area, index) => {
					const palette = palettes[index % palettes.length]
					const resuming = area.id === 'puzzle' && continuePuzzle
					const title = resuming ? 'Continue' : area.title
					const tagline = resuming
						? 'Pick up the puzzle you left unfinished.'
						: area.tagline
					return (
						<button
							key={area.id}
							type="button"
							className={styles.card}
							aria-labelledby={`${idPrefix}-${area.id}-title`}
							aria-describedby={`${idPrefix}-${area.id}-tagline`}
							onClick={open[area.id]}
						>
							{palette && (
								<span
									className={styles.bands}
									style={
										{
											backgroundImage: bands(
												palette.colors,
											),
										} as CSSProperties
									}
									aria-hidden="true"
								/>
							)}
							<span className={styles.caption}>
								<span className={styles.titleRow}>
									<FontAwesomeIcon
										icon={area.icon}
										className={styles.icon}
										aria-hidden="true"
									/>
									<span
										id={`${idPrefix}-${area.id}-title`}
										className={styles.title}
									>
										{title}
									</span>
								</span>
								<span
									id={`${idPrefix}-${area.id}-tagline`}
									className={styles.tagline}
								>
									{tagline}
								</span>
							</span>
						</button>
					)
				})}
			</div>
		</section>
	)
}
