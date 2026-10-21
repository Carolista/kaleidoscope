import { faRotate } from '@fortawesome/pro-solid-svg-icons'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import {
	AdminIconButton,
	AdminSectionHeading,
	errorMessage,
} from '@/features/admin/common'
import {
	checkRewardPattern,
	findUnavailablePalettes,
} from '@/features/admin/services'
import { Loading } from '@/ui/components'
import { shapeName } from './labels'
import useProgressionData from './useProgressionData'

const fallbackError = 'Unable to run the progression checks.'

// Warnings only: nothing here blocks publishing yet.
export default function ProgressionChecks({
	client,
}: {
	readonly client: SupabaseClient<Database>
}) {
	const data = useProgressionData(client, true)
	const { progression, puzzles } = data
	const paletteName = (id: string) =>
		data.palettes?.find(palette => palette.id === id)?.name ?? id
	const ready = !!progression && !!puzzles && !!data.paletteGroups
	const warnings = progression
		? checkRewardPattern(progression, {
				shape: shapeName,
				palette: paletteName,
			})
		: []
	const unavailable =
		puzzles && data.paletteGroups
			? findUnavailablePalettes({
					puzzles: puzzles.map(puzzle => ({
						name: puzzle.row.name,
						paletteId: puzzle.row.palette_id,
						groupName: puzzle.groupName,
					})),
					paletteGroups: data.paletteGroups,
					paletteName,
				})
			: []
	const orderedShapeIds = progression?.shapeIds ?? []

	return (
		<section aria-labelledby="progression-checks-title">
			<AdminSectionHeading id="progression-checks-title" title="Checks">
				<AdminIconButton
					icon={faRotate}
					label="Refresh checks"
					disabled={data.loading}
					onClick={() => {
						void data.refresh().catch(() => {})
					}}
				/>
			</AdminSectionHeading>
			<p>These checks only warn; they do not block publishing.</p>
			{!!data.error && (
				<p role="alert">{errorMessage(data.error, fallbackError)}</p>
			)}
			{!ready && data.loading && <Loading label="Running checks…" />}
			{ready && (
				<>
					<h3>Core groups and rewards</h3>
					{warnings.length === 0 ? (
						<p>Every shape follows the reward pattern.</p>
					) : (
						orderedShapeIds.concat(['']).map(shapeId => {
							const items = warnings.filter(warning =>
								shapeId === ''
									? warning.shapeId === null
									: warning.shapeId === shapeId,
							)
							return (
								items.length > 0 && (
									<section
										key={shapeId || 'general'}
										aria-label={`${shapeId ? shapeName(shapeId) : 'General'} warnings`}
									>
										<h4>
											{shapeId
												? shapeName(shapeId)
												: 'General'}
										</h4>
										<ul>
											{items.map(warning => (
												<li key={warning.message}>
													{warning.message}
												</li>
											))}
										</ul>
									</section>
								)
							)
						})
					)}
					<h3>Palettes players cannot get</h3>
					{unavailable.length === 0 ? (
						<p>
							Every palette used by a puzzle in a group is in a
							core, reward, or pack palette group.
						</p>
					) : (
						<>
							<p>
								These palettes are used by grouped puzzles but
								are not in a core, reward, or pack palette
								group, so the store could not offer them.
							</p>
							<ul>
								{unavailable.map(item => (
									<li key={item.paletteId}>
										<strong>{item.paletteName}</strong>:{' '}
										{item.puzzles.join(', ')}
									</li>
								))}
							</ul>
						</>
					)}
				</>
			)}
		</section>
	)
}
