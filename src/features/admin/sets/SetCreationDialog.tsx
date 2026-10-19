import { useId, useRef, useState, type SubmitEvent } from 'react'
import { ConfirmDialog, FormField, Input, Select } from '@/components/shared'
import { useUnsavedDraft } from '@/ui/navigation'
import { AdminForm } from '@/features/admin/common'

interface SetCreationDialogProps<Kind extends string> {
	readonly open: boolean
	readonly onAfterClose: () => void
	readonly title: string
	readonly formLabel: string
	readonly kindLabel: string
	readonly kinds: Readonly<Record<Kind, string>>
	readonly initialKind: NoInfer<Kind>
	readonly confirmLabel: string
	readonly pendingLabel: string
	readonly onCreate: (id: string, name: string, kind: Kind) => Promise<void>
	readonly onCancel: () => void
}

export default function SetCreationDialog<Kind extends string>({
	open,
	onAfterClose,
	title,
	formLabel,
	kindLabel,
	kinds,
	initialKind,
	confirmLabel,
	pendingLabel,
	onCreate,
	onCancel,
}: SetCreationDialogProps<Kind>) {
	const id = useId()
	const nameInput = useRef<HTMLInputElement>(null)
	const [name, setName] = useState('')
	const [kind, setKind] = useState(initialKind)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')
	const working = useRef(false)
	const request = useRef<{ id: string; content: string } | null>(null)
	useUnsavedDraft({
		dirty: name.length > 0 || kind !== initialKind,
		pending: busy,
	})

	async function save(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault()
		if (!open || working.current) return
		if (!name.trim()) {
			setError('Enter a set name.')
			return
		}
		const content = JSON.stringify({ name: name.trim(), kind })
		if (request.current?.content !== content)
			request.current = { id: crypto.randomUUID(), content }
		working.current = true
		setBusy(true)
		setError('')
		try {
			await onCreate(request.current.id, name.trim(), kind)
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: 'Unable to create the set.',
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
			title={title}
			closeLabel="Close set creation"
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
				<FormField label="Set name" id={`${id}-name`}>
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
				<FormField label={kindLabel} id={`${id}-kind`}>
					{field => (
						<Select
							{...field}
							value={kind}
							disabled={busy || !open}
							onChange={event => {
								const value = Object.keys(kinds).find(
									(value): value is Kind =>
										value === event.target.value,
								)
								if (value !== undefined) setKind(value)
							}}
						>
							{Object.entries<string>(kinds).map(
								([value, label]) => (
									<option key={value} value={value}>
										{label}
									</option>
								),
							)}
						</Select>
					)}
				</FormField>
			</AdminForm>
		</ConfirmDialog>
	)
}
