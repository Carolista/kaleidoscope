import { useState } from 'react'
import type { ColorScheme } from '@/types/colorScheme'
import { getGroupIds, HEXAGON_GRID_RADII } from '@/shape-geometry/hexagonGrid'
import HexPuzzleBoard from '@/components/puzzle/HexPuzzleBoard'
import { faWandMagicSparkles } from '@fortawesome/pro-solid-svg-icons'
import AdminIconButton from './AdminIconButton'
import styles from './SchemeLibrary.module.css'
import { AdminSectionHeading } from './AdminLayout'

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
			<AdminSectionHeading
				id="scheme-sandbox-title"
				title="Sandbox"
				level={3}
			>
				<AdminIconButton
					icon={faWandMagicSparkles}
					label="Randomize"
					onClick={() => setAssignments(randomize())}
				/>
			</AdminSectionHeading>
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
		</section>
	)
}
