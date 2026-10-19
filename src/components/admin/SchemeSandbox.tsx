import { useState } from 'react'
import type { ColorScheme } from '../../types/colorScheme'
import {
	getGroupIds,
	HEXAGON_GRID_RADII,
} from '../../shape-geometry/hexagonGrid'
import HexPuzzleBoard from '../puzzle/HexPuzzleBoard'
import { faWandMagicSparkles } from '@fortawesome/pro-solid-svg-icons'
import AdminIconButton from './AdminIconButton'
import styles from './SchemeLibrary.module.css'

export default function SchemeSandbox({
	colors,
}: {
	readonly colors: ColorScheme['colors'] | null
}) {
	const [assignments, setAssignments] = useState(() => randomize())
	function randomize() {
		return Object.fromEntries(
			getGroupIds(HEXAGON_GRID_RADII.md).map(group => [
				group,
				Math.floor(Math.random() * 5),
			]),
		)
	}
	const resolved = colors
		? Object.fromEntries(
				Object.entries(assignments).map(([group, slot]) => [
					group,
					colors[slot],
				]),
			)
		: {}
	return (
		<section className={styles.sandbox} aria-label="Palette sandbox">
			<div className={styles.heading}>
				<h3>Sandbox</h3>
				<AdminIconButton
					icon={faWandMagicSparkles}
					label="Randomize"
					onClick={() => setAssignments(randomize())}
				/>
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
