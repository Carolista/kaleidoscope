import { HexagonGrid } from '@/features/zen/grid'
import { Button, Heading } from '@/ui/components'
import { useZenState } from '@/features/zen/state'
import { useState } from 'react'
import { getThemeColors } from '@/domain/palettes'
import {
	generateHexagonCells,
	HEXAGON_GRID_RADII,
} from '@/domain/shapes/hexagon'
import { ColorSwatches } from '@/features/zen/controls/palettes'
import styles from './IntroSequence.module.css'

// The intro uses the smallest hexagon: six tiles, with the center already base
// color so the player fills the other five, one per palette color.
const INTRO_RADIUS = HEXAGON_GRID_RADII.sm
const INTRO_TILE_COUNT = 5
const CENTER_GROUP_ID = generateHexagonCells(INTRO_RADIUS).find(
	cell => cell.q === 0 && cell.r === 0,
)!.groupId

interface IntroSequenceProps {
	readonly onContinue: () => void
}

interface IntroDesign {
	readonly selectedColor: string | null
	readonly groupColors: Readonly<Record<string, string>>
}

function IntroSequence({ onContinue }: IntroSequenceProps) {
	const { state } = useZenState()
	const [design, setDesign] = useState<IntroDesign>({
		selectedColor: null,
		groupColors: {},
	})
	const { base } = getThemeColors(state.darkMode)
	const usedColors = Object.values(design.groupColors)
	const complete = usedColors.length === INTRO_TILE_COUNT
	const options = state.currentPalette.colors.map((color, i) => ({
		color,
		label: `Color ${i + 1}`,
	}))
	const message =
		usedColors.length === 0
			? 'Choose your first color and place it on the grid.'
			: usedColors.length === 1
				? 'Select a new color and add to your design.'
				: 'Place three more colors, then watch your kaleidoscope come to life!'

	function paint(groupId: string) {
		setDesign(current => {
			if (
				current.selectedColor === null ||
				current.groupColors[groupId] !== undefined ||
				Object.values(current.groupColors).includes(
					current.selectedColor,
				)
			) {
				return current
			}
			return {
				selectedColor: null,
				groupColors: {
					...current.groupColors,
					[groupId]: current.selectedColor,
				},
			}
		})
	}

	return (
		<section
			className={styles.intro}
			aria-labelledby={complete ? 'intro-congrats' : 'intro-welcome'}
		>
			{complete ? (
				<>
					<Heading
						level={2}
						id="intro-congrats"
						className={styles.exclamation}
					>
						Congratulations!
					</Heading>
					<p
						className={styles.message}
						role="status"
						aria-live="polite"
					>
						You've created your first kaleidoscope.
					</p>
				</>
			) : (
				<>
					<Heading
						level={2}
						id="intro-welcome"
						className={styles.exclamation}
					>
						Welcome!
					</Heading>
					<p
						className={styles.message}
						role="status"
						aria-live="polite"
					>
						Let's make a kaleidoscope.
					</p>
				</>
			)}
			<div className={styles.grid}>
				<HexagonGrid
					radius={INTRO_RADIUS}
					interaction={{
						groupColors: {
							...design.groupColors,
							[CENTER_GROUP_ID]: base,
						},
						onPaint: paint,
						isPaintable: groupId =>
							groupId !== CENTER_GROUP_ID &&
							design.selectedColor !== null &&
							design.groupColors[groupId] === undefined,
						highlightEditableArea: !complete,
					}}
				/>
			</div>
			{complete ? (
				<>
					<Button onClick={onContinue}>Continue</Button>
				</>
			) : (
				<>
					<ColorSwatches
						options={options}
						selectedColor={design.selectedColor}
						disabledColors={usedColors}
						onSelect={color =>
							setDesign(current => ({
								...current,
								selectedColor: color,
							}))
						}
					/>
					<p
						id="intro-instructions"
						className={styles.message}
						role="status"
						aria-live="polite"
					>
						{message}
					</p>
				</>
			)}
		</section>
	)
}

export default IntroSequence
