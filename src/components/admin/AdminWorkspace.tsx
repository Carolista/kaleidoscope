import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { AdminCatalogProvider } from './AdminCatalog'
import AdminNavigation from './AdminNavigation'
import PuzzleAuthoring from './PuzzleAuthoring'
import PuzzleSetLibrary from './PuzzleSetLibrary'
import SchemeLibrary from './SchemeLibrary'
import { useNavigationGuard } from './useNavigationGuard'

type CatalogStatus = 'drafts' | 'assigned' | 'scheduled' | 'published'

const catalogStatuses = [
	{ value: 'drafts', label: 'Drafts' },
	{ value: 'assigned', label: 'Assigned' },
	{ value: 'scheduled', label: 'Scheduled' },
	{ value: 'published', label: 'Published' },
] as const

export default function AdminWorkspace({
	client,
}: {
	readonly client: SupabaseClient<Database>
}) {
	const [section, setSection] = useState<'puzzles' | 'palettes' | 'shapes'>(
		'puzzles',
	)
	const [view, setView] = useState<'sets' | 'items'>('sets')
	const [status, setStatus] = useState<CatalogStatus>('drafts')
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
				]}
				value={section}
				onChange={next =>
					requestNavigation(() => {
						setSection(next)
						setView('sets')
						setStatus('drafts')
						setVisit(value => value + 1)
					})
				}
			/>
			{section === 'shapes' ? (
				<section aria-labelledby="admin-shapes-title">
					<h2 id="admin-shapes-title">Shapes</h2>
					<p>Shape management is not available yet.</p>
				</section>
			) : (
				<>
					<AdminNavigation
						label={`${itemLabel} views`}
						items={[
							{ value: 'sets', label: 'Sets' },
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
						<SchemeLibrary
							key={`${view}-${status}-${visit}`}
							client={client}
							view={view === 'sets' ? 'sets' : 'palettes'}
							catalogStatus={
								status === 'assigned' ? 'assigned' : 'drafts'
							}
						/>
					) : view === 'sets' ? (
						<PuzzleSetLibrary key={visit} client={client} />
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
