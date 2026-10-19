import { useRef } from 'react'
import {
	ControlsInfoButton,
	EditableAreaToggle,
	RandomizeDesignButton,
	ResetDesignButton,
	UndoRedoButtons,
} from '@/features/zen/controls'
import { GridShapeButton } from '@/features/zen/controls/shapes'
import { ColorOptions, PaletteButton } from '@/features/zen/controls/palettes'
import { SaveImageButton } from '@/features/zen/export'
import { GridTransition, ShapeGrid } from '@/features/zen/grid'
import { IntroSequence } from '@/features/zen/intro'
import { useZenState } from '@/features/zen/state'
import { DarkModeToggle } from '@/ui/components'
import styles from './ZenMode.module.css'

export default function ZenMode({
	isFirstVisit,
	showIntro,
	onIntroComplete,
}: {
	readonly isFirstVisit: boolean
	readonly showIntro: boolean
	readonly onIntroComplete: () => void
}) {
	const { state } = useZenState()
	const svgRef = useRef<SVGSVGElement>(null)

	return showIntro ? (
		<IntroSequence onContinue={onIntroComplete} />
	) : (
		<>
			<GridTransition
				gridKey={`${state.gridShape}:${state.gridSizes[state.gridShape]}`}
			>
				<ShapeGrid
					shape={state.gridShape}
					size={state.gridSizes[state.gridShape]}
					svgRef={svgRef}
				/>
			</GridTransition>
			<div
				role="group"
				aria-label="Controls"
				className={styles.controlRows}
			>
				<div className={styles.colorRow}>
					<ColorOptions />
				</div>
				<UndoRedoButtons />
				<div
					role="group"
					aria-label="Settings and Actions"
					className={styles.buttonGroup}
				>
					<div className={styles.buttonRow}>
						<EditableAreaToggle />
						<PaletteButton />
						<RandomizeDesignButton />
						<ResetDesignButton />
					</div>
					<div className={styles.buttonRow}>
						<GridShapeButton />
						<SaveImageButton svgRef={svgRef} />
						<DarkModeToggle />
						<ControlsInfoButton initialOpen={isFirstVisit} />
					</div>
				</div>
			</div>
		</>
	)
}
