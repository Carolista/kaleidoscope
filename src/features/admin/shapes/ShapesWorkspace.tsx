import { faRotate } from '@fortawesome/pro-solid-svg-icons'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PUZZLE_SHAPE_IDS } from '@/domain/puzzles'
import { useCatalog } from '@/features/admin/catalog'
import {
	AdminFeedback,
	AdminIconButton,
	AdminSectionHeading,
	errorMessage,
} from '@/features/admin/common'
import type { Database } from '@/lib/supabase'
import { Loading } from '@/ui/components'
import ShapeCard from './ShapeCard'

const fallbackError = 'Unable to check which shapes have puzzles.'

// A workbench for grid sizes (n) and piece mixes: shapes with puzzles show their
// values read-only; the rest can be tried out, with samples to play.
export default function ShapesWorkspace({
	client,
}: {
	readonly client: SupabaseClient<Database>
}) {
	const counts = useCatalog('shapePuzzleCounts', client)
	return (
		<section aria-labelledby="admin-shapes-title">
			<AdminSectionHeading id="admin-shapes-title" title="Shapes">
				<AdminIconButton
					icon={faRotate}
					label="Refresh shapes"
					disabled={counts.loading}
					onClick={() => {
						void counts.refresh().catch(() => {})
					}}
				/>
			</AdminSectionHeading>
			<AdminFeedback
				error={
					counts.error
						? errorMessage(counts.error, fallbackError)
						: ''
				}
				status=""
			/>
			{counts.loading && !counts.data ? (
				<Loading label="Loading shapes…" />
			) : (
				counts.data &&
				PUZZLE_SHAPE_IDS.map(id => (
					<ShapeCard
						key={id}
						shapeId={id}
						puzzleCount={counts.data?.[id] ?? 0}
					/>
				))
			)}
		</section>
	)
}
