import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Button, ConfirmDialog, Loading } from '@/ui/components'
import type { Database } from '@/lib/supabase'
import {
	manageColorScheme,
	type CatalogScheme,
	loadSchemeUsage,
	schemeIsUsed,
	type SchemeUsage,
} from '@/features/admin/services'
import { useUnsavedDraft } from '@/ui/navigation'
import PaletteUsageDetails from './PaletteUsageDetails'

export default function PaletteDeleteDialog({
	client,
	scheme,
	onCancel,
	onDeleted,
	open,
	onAfterClose,
}: {
	readonly client: SupabaseClient<Database>
	readonly scheme: CatalogScheme
	readonly onCancel: () => void
	readonly onDeleted: () => void
	readonly open: boolean
	readonly onAfterClose: () => void
}) {
	const [usage, setUsage] = useState<SchemeUsage | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [usageError, setUsageError] = useState('')
	const [retry, setRetry] = useState(0)
	const [busy, setBusy] = useState(false)
	const working = useRef(false)
	useUnsavedDraft({ dirty: false, pending: busy })
	useEffect(() => {
		let active = true
		void loadSchemeUsage(client, scheme.id)
			.then(value => {
				if (active) setUsage(value)
			})
			.catch((cause: unknown) => {
				if (active)
					setUsageError(
						cause instanceof Error
							? cause.message
							: 'Unable to check palette usage.',
					)
			})
			.finally(() => {
				if (active) setLoading(false)
			})
		return () => {
			active = false
		}
	}, [client, scheme.id, retry])
	const blocked =
		!open ||
		!!scheme.published_at ||
		!!scheme.release_at ||
		!usage ||
		schemeIsUsed(usage) ||
		loading ||
		!!usageError
	async function remove() {
		if (working.current || blocked) return
		working.current = true
		setBusy(true)
		setError('')
		try {
			await manageColorScheme(client, {
				kind: 'delete',
				previous: scheme,
			})
			onDeleted()
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: 'Unable to delete the palette.',
			)
		} finally {
			working.current = false
			setBusy(false)
		}
	}
	return (
		<ConfirmDialog
			open={open}
			onAfterClose={onAfterClose}
			title="Confirm palette deletion"
			closeLabel="Close palette deletion"
			destructive
			message={`Delete "${scheme.name}" permanently? Any draft set membership will be removed.`}
			confirmLabel="Confirm delete palette"
			cancelLabel="Cancel deletion"
			confirmDisabled={blocked}
			pending={busy ? 'Deleting palette…' : null}
			error={error}
			onConfirm={() => {
				void remove()
			}}
			onCancel={onCancel}
		>
			{loading && <Loading label="Loading palette usage…" />}
			{usageError && (
				<p role="alert">
					{usageError} Deletion is disabled until usage can be
					checked.
				</p>
			)}
			{usageError && (
				<Button
					onClick={() => {
						setLoading(true)
						setUsageError('')
						setRetry(value => value + 1)
					}}
				>
					Retry palette usage
				</Button>
			)}
			{usage && !loading && !usageError && (
				<>
					{schemeIsUsed(usage) && (
						<p>This palette is in use and cannot be deleted.</p>
					)}
					<PaletteUsageDetails usage={usage} colors={scheme.colors} />
				</>
			)}
			{(scheme.published_at || scheme.release_at) && (
				<p>Published or scheduled palettes cannot be deleted.</p>
			)}
		</ConfirmDialog>
	)
}
