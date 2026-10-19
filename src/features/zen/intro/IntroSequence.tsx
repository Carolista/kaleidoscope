import { TriangleGrid } from '@/features/zen/grid'
import { Button } from '@/ui/components'
import { useZenState } from '@/features/zen/state'
import { useState } from 'react'
import { TRIANGLE_GRID_SIZES } from '@/domain/shapes/triangle'
import { ColorSwatches } from '@/features/zen/controls/palettes'
import styles from './IntroSequence.module.css'

// The intro demonstrates the smallest selectable triangle size (5 groups).
const INTRO_GRID_SIZE = TRIANGLE_GRID_SIZES.sm
const INTRO_TILE_COUNT = 5

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
					<h2 id="intro-congrats" className={styles.exclamation}>
						Congratulations!
					</h2>
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
					<h2 id="intro-welcome" className={styles.exclamation}>
						Welcome!
					</h2>
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
				<TriangleGrid
					gridSize={INTRO_GRID_SIZE}
					interaction={{
						groupColors: design.groupColors,
						onPaint: paint,
						isPaintable: groupId =>
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
