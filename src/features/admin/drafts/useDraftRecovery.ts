import { useCallback, useEffect, useState } from 'react'
import { useDraftScope } from './draftScope'
import { readDraft, removeDraft, writeDraft } from './draftStorage'

interface DraftRecoveryOptions<T> {
	// Stable for the lifetime of the editor instance; include the item's ID.
	readonly key: string
	// Whether the editor holds changes that aren't saved to the server.
	readonly dirty: boolean
	// Minimal, JSON-serializable description of the in-progress work.
	readonly snapshot: T
	// Validates stored data; return null to ignore it.
	readonly parse: (raw: unknown) => T | null
	readonly onRestore: (snapshot: T) => void
}

export interface DraftRecovery {
	// True while a stored draft awaits a decision from the user.
	readonly pending: boolean
	readonly restore: () => void
	// Forgets the stored draft; call when the user deliberately discards work.
	readonly discard: () => void
}

export default function useDraftRecovery<T>({
	key,
	dirty,
	snapshot,
	parse,
	onRestore,
}: DraftRecoveryOptions<T>): DraftRecovery {
	const userId = useDraftScope()?.userId
	const [recovered, setRecovered] = useState<T | null>(() =>
		userId ? parse(readDraft(userId, key)) : null,
	)
	const pending = recovered !== null
	const serialized = JSON.stringify(snapshot)

	// Persist on every change so nothing is lost to a crash or reload. Writes
	// wait while a recovered draft is undecided, or they would overwrite it.
	useEffect(() => {
		if (!userId || pending) return
		if (dirty) writeDraft(userId, key, JSON.parse(serialized))
		else removeDraft(userId, key)
	}, [userId, key, pending, dirty, serialized])

	const restore = useCallback(() => {
		if (recovered === null) return
		onRestore(recovered)
		setRecovered(null)
	}, [recovered, onRestore])

	const discard = useCallback(() => {
		if (userId) removeDraft(userId, key)
		setRecovered(null)
	}, [userId, key])

	return { pending, restore, discard }
}
