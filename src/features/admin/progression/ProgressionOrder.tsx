import { faRotate } from '@fortawesome/pro-solid-svg-icons'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useRef, useState } from 'react'
import { isPuzzleShapeId } from '@/domain/puzzles'
import type { Database } from '@/lib/supabase'
import {
	AdminFeedback,
	AdminIconButton,
	AdminSectionHeading,
	errorMessage,
} from '@/features/admin/common'
import { SortableGroupMembers, useStagedOrder } from '@/features/admin/groups'
import { manageShapeProgression } from '@/features/admin/services'
import { Button, GridShapeIcon, Loading } from '@/ui/components'
import { useUnsavedDraft } from '@/ui/navigation'
import { shapeName } from './labels'
import styles from './ProgressionOrder.module.css'
import useProgressionData from './useProgressionData'

const fallbackError = 'Unable to manage the shape order.'

// The order shapes unlock in: completing a core group of one opens the next.
export default function ProgressionOrder({
	client,
}: {
	readonly client: SupabaseClient<Database>
}) {
	const data = useProgressionData(client)
	const progression = data.progression
	const shapes = (progression?.shapeIds ?? []).map(id => ({
		id,
		name: shapeName(id),
	}))
	const order = useStagedOrder(shapes, shape => shape.id)
	const [busy, setBusy] = useState(false)
	const working = useRef(false)
	const [error, setError] = useState('')
	const [status, setStatus] = useState('')
	const locked = !!progression?.locked
	useUnsavedDraft({ dirty: order.dirty, pending: busy })

	async function save() {
		if (working.current || !order.dirty || locked) return
		working.current = true
		setBusy(true)
		setError('')
		setStatus('')
		const shapeIds = order.ordered.map(shape => shape.id)
		try {
			await manageShapeProgression(client, shapeIds)
			data.updateProgression(previous => ({ ...previous, shapeIds }))
			order.reset()
			setStatus('Shape order saved.')
		} catch (cause) {
			setError(errorMessage(cause, fallbackError))
		} finally {
			working.current = false
			setBusy(false)
		}
	}

	return (
		<section aria-labelledby="progression-order-title">
			<AdminSectionHeading
				id="progression-order-title"
				title="Shape order"
			>
				<AdminIconButton
					icon={faRotate}
					label="Refresh shape order"
					disabled={busy || data.loading}
					onClick={() => {
						setError('')
						setStatus('')
						order.reset()
						void data.refresh().catch(() => {})
					}}
				/>
			</AdminSectionHeading>
			<p>
				Players start with the first shape. Completing either core group
				(basic or rotation) of a shape unlocks the next one.
			</p>
			<AdminFeedback
				error={
					error ||
					(data.error ? errorMessage(data.error, fallbackError) : '')
				}
				status={status}
			/>
			{locked && (
				<p role="note">
					The shape order is locked because a core group is published.
				</p>
			)}
			{data.loading && !progression ? (
				<Loading label="Loading shape order…" />
			) : (
				progression && (
					<>
						<SortableGroupMembers
							members={order.ordered}
							noun="shapes"
							disabled={busy || locked}
							onReorder={order.setOrder}
							preview={shape =>
								isPuzzleShapeId(shape.id) && (
									<div className={styles.icon}>
										<GridShapeIcon shape={shape.id} />
									</div>
								)
							}
						>
							{(shape, index) => (
								<div className={styles.shape}>
									<strong className={styles.shapeName}>
										{shape.name}
									</strong>
									<span className={styles.detail}>
										{index === 0
											? 'Open from the start'
											: `Unlocks when a ${order.ordered[index - 1].name} core group is completed`}
									</span>
								</div>
							)}
						</SortableGroupMembers>
						<Button
							variant="primary"
							disabled={busy || !order.dirty || locked}
							onClick={() => {
								void save()
							}}
						>
							Save order
						</Button>
					</>
				)
			)}
			{busy && <Loading label="Saving shape order…" />}
		</section>
	)
}
