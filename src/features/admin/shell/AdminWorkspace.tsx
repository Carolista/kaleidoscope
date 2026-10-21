import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { AdminCatalogProvider } from '@/features/admin/catalog'
import AdminNavigation from './AdminNavigation'
import { PuzzleAuthoring } from '@/features/admin/puzzles'
import { PuzzleGroupLibrary } from '@/features/admin/puzzle-groups'
import { PaletteLibrary } from '@/features/admin/palettes'
import {
	ProgressionOrder,
	ProgressionSlots,
} from '@/features/admin/progression'
import { ShapesWorkspace } from '@/features/admin/shapes'
import { useNavigationGuard } from '@/ui/navigation'

type CatalogStatus = 'drafts' | 'assigned' | 'scheduled' | 'published'

const catalogStatuses = [
	{ value: 'drafts', label: 'Unassigned' },
	{ value: 'assigned', label: 'Assigned' },
	{ value: 'scheduled', label: 'Scheduled' },
	{ value: 'published', label: 'Published' },
] as const

export default function AdminWorkspace({
	client,
}: {
	readonly client: SupabaseClient<Database>
}) {
	const [section, setSection] = useState<
		'puzzles' | 'palettes' | 'shapes' | 'progression'
	>('puzzles')
	const [view, setView] = useState<'groups' | 'items'>('groups')
	const [status, setStatus] = useState<CatalogStatus>('drafts')
	const [progressionView, setProgressionView] = useState<'order' | 'rewards'>(
		'rewards',
	)
	// Choosing any tab, including the current one, returns to that view's list.
	const [visit, setVisit] = useState(0)
	const { requestNavigation } = useNavigationGuard()
	const itemLabel = section === 'palettes' ? 'Palettes' : 'Puzzles'
	const placeholder =
		view === 'items' && (status === 'scheduled' || status === 'published')

	return (
		<AdminCatalogProvider>
			<AdminNavigation
				label="Admin sections"
				items={[
					{ value: 'puzzles', label: 'Puzzles' },
					{ value: 'palettes', label: 'Palettes' },
					{ value: 'shapes', label: 'Shapes' },
					{ value: 'progression', label: 'Progression' },
				]}
				value={section}
				onChange={next =>
					requestNavigation(() => {
						setSection(next)
						setView('groups')
						setStatus('drafts')
						setProgressionView('rewards')
						setVisit(value => value + 1)
					})
				}
			/>
			{section === 'progression' ? (
				<>
					<AdminNavigation
						label="Progression views"
						items={[
							{ value: 'rewards', label: 'Puzzles and Rewards' },
							{ value: 'order', label: 'Order' },
						]}
						value={progressionView}
						onChange={next =>
							requestNavigation(() => {
								setProgressionView(next)
								setVisit(value => value + 1)
							})
						}
					/>
					{progressionView === 'order' ? (
						<ProgressionOrder key={visit} client={client} />
					) : (
						<ProgressionSlots key={visit} client={client} />
					)}
				</>
			) : section === 'shapes' ? (
				<ShapesWorkspace client={client} />
			) : (
				<>
					<AdminNavigation
						label={`${itemLabel} views`}
						items={[
							{ value: 'groups', label: 'Groups' },
							{ value: 'items', label: itemLabel },
						]}
						value={view}
						onChange={next =>
							requestNavigation(() => {
								setView(next)
								setStatus('drafts')
								setVisit(value => value + 1)
							})
						}
					/>
					{view === 'items' && (
						<AdminNavigation
							label={`${itemLabel} status`}
							items={catalogStatuses}
							value={status}
							onChange={next =>
								requestNavigation(() => {
									setStatus(next)
									setVisit(value => value + 1)
								})
							}
						/>
					)}
					{placeholder ? (
						<section aria-labelledby="catalog-placeholder-title">
							<h2 id="catalog-placeholder-title">
								{status === 'scheduled'
									? 'Scheduled'
									: 'Published'}{' '}
								{itemLabel.toLowerCase()}
							</h2>
							<p>
								This catalog view is not available yet. Release
								tools will be added separately.
							</p>
						</section>
					) : section === 'palettes' ? (
						<PaletteLibrary
							key={`${view}-${status}-${visit}`}
							client={client}
							view={view === 'groups' ? 'groups' : 'palettes'}
							catalogStatus={
								status === 'assigned' ? 'assigned' : 'drafts'
							}
						/>
					) : view === 'groups' ? (
						<PuzzleGroupLibrary key={visit} client={client} />
					) : (
						<PuzzleAuthoring
							key={`${status}-${visit}`}
							client={client}
							catalogStatus={
								status === 'assigned' ? 'assigned' : 'drafts'
							}
						/>
					)}
				</>
			)}
		</AdminCatalogProvider>
	)
}
