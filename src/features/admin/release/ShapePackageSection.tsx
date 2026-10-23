import type { Palette } from '@/domain/palettes'
import { packageRelease, type SlotRelease } from '@/features/admin/services'
import { PaletteStrip } from '@/ui/components'
import ReleaseActions from './ReleaseActions'
import type { ReleaseTarget } from './ReleaseDialog'
import styles from './ReleaseOverview.module.css'
import { releaseStateText, shapeLabel } from './releaseText'

// One shape's core and bonus groups: released together as a package,
// so the status, problems, and buttons are for the package while each
// slot row shows its own group, reward, and state.
export default function ShapePackageSection({
	shapeId,
	slots,
	palettes,
	disabled,
	onStart,
}: {
	readonly shapeId: string
	readonly slots: readonly SlotRelease[]
	readonly palettes: ReadonlyMap<string, Pick<Palette, 'name' | 'colors'>>
	readonly disabled: boolean
	readonly onStart: (target: ReleaseTarget) => void
}) {
	const label = shapeLabel(shapeId)
	const pkg = packageRelease(slots)
	const status =
		pkg.state === 'partial'
			? 'Partly scheduled'
			: pkg.row
				? releaseStateText(pkg.row)
				: 'Draft'
	return (
		<section
			className={styles.block}
			aria-labelledby={`release-${shapeId}`}
		>
			<div className={styles.packageHeading}>
				<h3 id={`release-${shapeId}`}>{label}</h3>
				<span>
					{pkg.filled} of {slots.length} groups · {status}
				</span>
				<ReleaseActions
					kind="shape_package"
					id={shapeId}
					name={`${label} package`}
					row={pkg.row ?? { published_at: null, release_at: null }}
					issue={
						pkg.issues.length
							? `${pkg.issues.length} problem${pkg.issues.length === 1 ? '' : 's'} to fix before releasing`
							: undefined
					}
					disabled={disabled || !pkg.row}
					onStart={onStart}
				/>
			</div>
			{pkg.issues.length > 0 && (
				<ul
					className={styles.issues}
					aria-label={`${label} package problems`}
				>
					{pkg.issues.map(issue => (
						<li key={issue}>{issue}</li>
					))}
				</ul>
			)}
			<div className={styles.scroll}>
				<table
					className={styles.table}
					aria-label={`${label} release status`}
				>
					<thead>
						<tr>
							<th scope="col" style={{ width: '15%' }}>
								Slot
							</th>
							<th scope="col" style={{ width: '25%' }}>
								Puzzle group
							</th>
							<th scope="col" style={{ width: '50%' }}>
								Reward
							</th>
							<th scope="col" style={{ width: '10%' }}>
								Status
							</th>
						</tr>
					</thead>
					<tbody>
						{slots.map(slot => {
							const palette = slot.paletteId
								? palettes.get(slot.paletteId)
								: undefined
							return (
								<tr key={slot.title}>
									<th scope="row">{slot.title}</th>
									<td>
										{slot.group ? (
											<>
												<strong>
													{slot.group.name}
												</strong>
												<span className={styles.detail}>
													{slot.puzzleCount} puzzles
												</span>
											</>
										) : (
											<span className={styles.empty}>
												Not assigned
											</span>
										)}
									</td>
									<td>
										{palette ? (
											<span className={styles.reward}>
												<PaletteStrip
													colors={palette.colors}
												/>
												{palette.name}
											</span>
										) : (
											<span className={styles.empty}>
												{slot.group
													? 'No palette yet'
													: '—'}
											</span>
										)}
										{slot.unlocks.length > 0 && (
											<span className={styles.detail}>
												Also unlocks:{' '}
												{slot.unlocks.join(', ')}
											</span>
										)}
									</td>
									<td>
										{slot.row
											? releaseStateText(slot.row)
											: slot.group
												? 'Draft'
												: '—'}
									</td>
								</tr>
							)
						})}
					</tbody>
				</table>
			</div>
		</section>
	)
}
