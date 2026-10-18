import { useState } from 'react'
import type { ColorScheme } from '../../types/colorScheme'
import {
	getGroupIds,
	HEXAGON_GRID_RADII,
} from '../../shape-geometry/hexagonGrid'
import { generateRandomShapeGroupColors } from '../../utils/randomDesign'
import HexPuzzleBoard from '../puzzle/HexPuzzleBoard'
import styles from './SchemeLibrary.module.css'

const slots: ColorScheme = {
	name: 'Preview slots',
	colors: ['0', '1', '2', '3', '4'],
}

export default function SchemeSandbox({
	colors,
}: {
	readonly colors: ColorScheme['colors'] | null
}) {
	const [assignments, setAssignments] = useState(() => randomize())
	function randomize() {
		return generateRandomShapeGroupColors(
			getGroupIds(HEXAGON_GRID_RADII.md),
			slots,
			'base',
		)
	}
	const resolved = colors
		? Object.fromEntries(
				Object.entries(assignments).map(([group, slot]) => [
					group,
					slot === 'base' ? 'var(--base)' : colors[Number(slot)],
				]),
			)
		: {}
	return (
		<section className={styles.sandbox} aria-label="Palette sandbox">
			<div className={styles.heading}>
				<h3>Sandbox</h3>
				<button
					type="button"
					onClick={() => setAssignments(randomize())}
				>
					Randomize
				</button>
			</div>
			{colors ? (
				<HexPuzzleBoard
					target
					label="Palette sandbox design"
					radius={HEXAGON_GRID_RADII.md}
					colors={resolved}
				/>
			) : (
				<p>Enter five valid hex colors to preview this palette.</p>
			)}
			<p className={styles.help}>
				Color edits recolor this pattern. Randomize tries another
				pattern.
			</p>
		</section>
	)
}
