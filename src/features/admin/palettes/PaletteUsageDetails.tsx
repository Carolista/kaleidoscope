import type { Palette } from '@/domain/palettes'
import { SeparatorDot } from '@/features/admin/common'
import { paletteIsUsed, type PaletteUsage } from '@/features/admin/services'
import { Fragment } from 'react'
import { PuzzleBoard } from '@/ui/puzzle'
import styles from './PaletteUsageDetails.module.css'

function DotSeparated({ parts }: { readonly parts: readonly string[] }) {
	return parts.map((part, index) => (
		<Fragment key={index}>
			{index > 0 && (
				<>
					{' '}
					<SeparatorDot />{' '}
				</>
			)}
			{part}
		</Fragment>
	))
}

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
			{usage.groups.length > 0 && (
				<>
					<h4>Palette groups</h4>
					<ul>
						{usage.groups.map((parts, index) => (
							<li key={index}>
								<DotSeparated parts={parts} />
							</li>
						))}
					</ul>
				</>
			)}
			{usage.rewards.length > 0 && (
				<>
					<h4>Reward for completing</h4>
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
									<DotSeparated parts={puzzle.context} />
								</span>
							</li>
						))}
					</ul>
				</>
			)}
		</>
	)
}
