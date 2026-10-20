import { useId, useRef, useState, type SubmitEvent } from 'react'
import { ConfirmDialog, FormField, Input } from '@/ui/components'
import { useUnsavedDraft } from '@/ui/navigation'
import { AdminForm, errorMessage } from '@/features/admin/common'
import { trackForPurpose } from '@/features/admin/services'
import GroupDetailsFields from './GroupDetailsFields'
import { sameGroupDetails, type GroupDetailsValue } from './groupDetailsValue'

interface GroupCreationDialogProps<Purpose extends string> {
	readonly open: boolean
	readonly onAfterClose: () => void
	readonly title: string
	readonly formLabel: string
	readonly purposes: Readonly<Record<Purpose, string>>
	readonly initialPurpose: NoInfer<Purpose>
	readonly confirmLabel: string
	readonly pendingLabel: string
	// Puzzle groups also choose a shape and track; palette groups only a purpose.
	readonly puzzleDetails?: boolean
	readonly onCreate: (
		id: string,
		name: string,
		value: GroupDetailsValue<Purpose>,
	) => Promise<void>
	readonly onCancel: () => void
}

export default function GroupCreationDialog<Purpose extends string>({
	open,
	onAfterClose,
	title,
	formLabel,
	purposes,
	initialPurpose,
	confirmLabel,
	pendingLabel,
	puzzleDetails = false,
	onCreate,
	onCancel,
}: GroupCreationDialogProps<Purpose>) {
	const id = useId()
	const nameInput = useRef<HTMLInputElement>(null)
	const initial: GroupDetailsValue<Purpose> = {
		purpose: initialPurpose,
		shape: 'hexagon',
		track: puzzleDetails ? trackForPurpose(initialPurpose, null) : null,
	}
	const [name, setName] = useState('')
	const [details, setDetails] = useState(initial)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')
	const working = useRef(false)
	const request = useRef<{ id: string; content: string } | null>(null)
	useUnsavedDraft({
		dirty:
			name.length > 0 ||
			!sameGroupDetails(details, initial, puzzleDetails),
		pending: busy,
	})

	async function save(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault()
		if (!open || working.current) return
		if (!name.trim()) {
			setError('Enter a group name.')
			return
		}
		const content = JSON.stringify({ name: name.trim(), details })
		if (request.current?.content !== content)
			request.current = { id: crypto.randomUUID(), content }
		working.current = true
		setBusy(true)
		setError('')
		try {
			await onCreate(request.current.id, name.trim(), details)
		} catch (cause) {
			setError(errorMessage(cause, 'Unable to create the group.'))
		} finally {
			working.current = false
			setBusy(false)
		}
	}

	return (
		<ConfirmDialog
			open={open}
			onAfterClose={onAfterClose}
			title={title}
			closeLabel="Close group creation"
			initialFocusRef={nameInput}
			confirmLabel={confirmLabel}
			confirmForm={`${id}-form`}
			onConfirm={() => {}}
			onCancel={onCancel}
			confirmDisabled={!name.trim()}
			pending={busy ? pendingLabel : null}
			error={error}
		>
			<AdminForm id={`${id}-form`} aria-label={formLabel} onSubmit={save}>
				<FormField label="Group name" id={`${id}-name`}>
					{field => (
						<Input
							{...field}
							ref={nameInput}
							required
							value={name}
							disabled={busy || !open}
							onChange={event => setName(event.target.value)}
						/>
					)}
				</FormField>
				<GroupDetailsFields
					idPrefix={id}
					purposes={purposes}
					value={details}
					puzzleDetails={puzzleDetails}
					disabled={busy || !open}
					onChange={setDetails}
				/>
			</AdminForm>
		</ConfirmDialog>
	)
}
