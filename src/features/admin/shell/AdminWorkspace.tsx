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
import { ReleaseOverview } from '@/features/admin/release'
import { ShapesWorkspace } from '@/features/admin/shapes'
import { useNavigationGuard } from '@/ui/navigation'

export default function AdminWorkspace({
	client,
}: {
	readonly client: SupabaseClient<Database>
}) {
	const [section, setSection] = useState<
		'puzzles' | 'palettes' | 'shapes' | 'progression' | 'release'
	>('puzzles')
	const [view, setView] = useState<'groups' | 'items'>('groups')
	const [progressionView, setProgressionView] = useState<'order' | 'rewards'>(
		'rewards',
	)
	// Choosing any tab, including the current one, returns to that view's list.
	const [visit, setVisit] = useState(0)
	const { requestNavigation } = useNavigationGuard()
	const itemLabel = section === 'palettes' ? 'Palettes' : 'Puzzles'

	return (
		<AdminCatalogProvider>
			<AdminNavigation
				label="Admin sections"
				items={[
					{ value: 'puzzles', label: 'Puzzles' },
					{ value: 'palettes', label: 'Palettes' },
					{ value: 'shapes', label: 'Shapes' },
					{ value: 'progression', label: 'Progression' },
					{ value: 'release', label: 'Release' },
				]}
				value={section}
				onChange={next =>
					requestNavigation(() => {
						setSection(next)
						setView('groups')
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
			) : section === 'release' ? (
				<ReleaseOverview key={visit} client={client} />
			) : section === 'shapes' ? (
				<ShapesWorkspace client={client} />
			) : (
				<>
					<AdminNavigation
						label={`${itemLabel} views`}
						items={[
							{ value: 'groups', label: 'Groups' },
							{ value: 'items', label: 'Individual' },
						]}
						value={view}
						onChange={next =>
							requestNavigation(() => {
								setView(next)
								setVisit(value => value + 1)
							})
						}
					/>
					{section === 'palettes' ? (
						<PaletteLibrary
							key={`${view}-${visit}`}
							client={client}
							view={view === 'groups' ? 'groups' : 'palettes'}
						/>
					) : view === 'groups' ? (
						<PuzzleGroupLibrary key={visit} client={client} />
					) : (
						<PuzzleAuthoring key={visit} client={client} />
					)}
				</>
			)}
		</AdminCatalogProvider>
	)
}
