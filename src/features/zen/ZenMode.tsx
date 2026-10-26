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
import { ZenIntro } from '@/features/zen/intro'
import { useZenState } from '@/features/zen/state'
import styles from './ZenMode.module.css'

export default function ZenMode({
	isFirstVisit,
	showIntro,
	onIntroComplete,
	openPalette = false,
}: {
	readonly isFirstVisit: boolean
	readonly showIntro: boolean
	readonly onIntroComplete: () => void
	// Opens the palette picker on arrival, unless the first-visit controls info is
	// already doing so.
	readonly openPalette?: boolean
}) {
	const { state } = useZenState()
	const svgRef = useRef<SVGSVGElement>(null)

	return showIntro ? (
		<ZenIntro onContinue={onIntroComplete} />
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
						<PaletteButton
							initialOpen={openPalette && !isFirstVisit}
						/>
						<RandomizeDesignButton />
						<ResetDesignButton />
					</div>
					<div className={styles.buttonRow}>
						<GridShapeButton />
						<SaveImageButton svgRef={svgRef} />
						<ControlsInfoButton initialOpen={isFirstVisit} />
					</div>
				</div>
			</div>
		</>
	)
}
