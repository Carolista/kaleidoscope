import type { Palette } from '@/domain/palettes'
import { paletteIsUsed, type PaletteUsage } from '@/features/admin/services'
import { PuzzleBoard } from '@/ui/puzzle'
import styles from './PaletteUsageDetails.module.css'

export default function PaletteUsageDetails({
	usage,
	colors,
}: {
	readonly usage: PaletteUsage
	readonly colors: Palette['colors'] | null
}) {
	if (!paletteIsUsed(usage)) return <p>Not used anywhere.</p>
	return (
		<>
			{usage.starters > 0 && <p>Included in starter offerings.</p>}
			{usage.packs.length > 0 && (
				<>
					<h4>Palette sets</h4>
					<ul>
						{usage.packs.map((name, index) => (
							<li key={index}>{name}</li>
						))}
					</ul>
				</>
			)}
			{usage.rewards.length > 0 && (
				<>
					<h4>Puzzle rewards</h4>
					<ul>
						{usage.rewards.map((name, index) => (
							<li key={index}>{name}</li>
						))}
					</ul>
				</>
			)}
			{usage.grants > 0 && <p>Ownership grants: {usage.grants}</p>}
			{usage.corrections > 0 && (
				<p>Correction history records: {usage.corrections}</p>
			)}
			{usage.puzzles.length > 0 && (
				<>
					<h4>Linked puzzles ({usage.puzzles.length})</h4>
					<ul className={styles.linkedPuzzles}>
						{usage.puzzles.map(puzzle => (
							<li key={puzzle.id}>
								{puzzle.preview && colors && (
									<div className={styles.thumbnail}>
										<PuzzleBoard
											target
											label={`${puzzle.name} palette preview`}
											shape={puzzle.preview.shape}
											gridSize={puzzle.preview.gridSize}
											colors={Object.fromEntries(
												Object.entries(
													puzzle.preview.target,
												).map(([group, slot]) => [
													group,
													colors[slot],
												]),
											)}
										/>
									</div>
								)}
								<span>
									<strong>{puzzle.name}</strong>
									<br />
									{puzzle.context}
								</span>
							</li>
						))}
					</ul>
				</>
			)}
		</>
	)
}
