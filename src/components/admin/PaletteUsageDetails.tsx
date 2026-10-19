import type { ColorScheme } from '../../types/colorScheme'
import { schemeIsUsed, type SchemeUsage } from '../../services/schemeUsage'
import HexPuzzleBoard from '../puzzle/HexPuzzleBoard'
import styles from './SchemeLibrary.module.css'

export default function PaletteUsageDetails({
	usage,
	colors,
}: {
	readonly usage: SchemeUsage
	readonly colors: ColorScheme['colors'] | null
}) {
	return (
		<>
			<p>
				{usage.starters
					? 'Included in starter offerings.'
					: 'Not a starter palette.'}
			</p>
			<p>
				{schemeIsUsed(usage)
					? 'This palette is in use and cannot be deleted.'
					: 'No saved references blocking deletion.'}
			</p>
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
										<HexPuzzleBoard
											target
											label={`${puzzle.name} palette preview`}
											radius={puzzle.preview.radius}
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
