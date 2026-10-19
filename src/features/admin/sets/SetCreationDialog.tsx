import { useId, useRef, useState, type SubmitEvent } from 'react'
import { ConfirmDialog, FormField, Input, Select } from '@/ui/components'
import { useUnsavedDraft } from '@/ui/navigation'
import { AdminForm, errorMessage } from '@/features/admin/common'

interface SetChoice<Value extends string> {
	readonly label: string
	readonly options: Readonly<Record<Value, string>>
	readonly initial: NoInfer<Value>
}

interface SetCreationDialogProps<Kind extends string, Shape extends string> {
	readonly open: boolean
	readonly onAfterClose: () => void
	readonly title: string
	readonly formLabel: string
	readonly kindLabel: string
	readonly kinds: Readonly<Record<Kind, string>>
	readonly initialKind: NoInfer<Kind>
	readonly confirmLabel: string
	readonly pendingLabel: string
	// Puzzle sets choose one shape at creation; palette sets omit this.
	readonly shape?: SetChoice<Shape>
	readonly onCreate: (
		id: string,
		name: string,
		kind: Kind,
		shape: Shape | undefined,
	) => Promise<void>
	readonly onCancel: () => void
}

function ChoiceField<Value extends string>({
	id,
	label,
	options,
	value,
	disabled,
	onChange,
}: {
	readonly id: string
	readonly label: string
	readonly options: Readonly<Record<Value, string>>
	readonly value: Value
	readonly disabled: boolean
	readonly onChange: (value: Value) => void
}) {
	return (
		<FormField label={label} id={id}>
			{field => (
				<Select
					{...field}
					value={value}
					disabled={disabled}
					onChange={event => {
						const next = Object.keys(options).find(
							(option): option is Value =>
								option === event.target.value,
						)
						if (next !== undefined) onChange(next)
					}}
				>
					{Object.entries<string>(options).map(([option, text]) => (
						<option key={option} value={option}>
							{text}
						</option>
					))}
				</Select>
			)}
		</FormField>
	)
}

export default function SetCreationDialog<
	Kind extends string,
	Shape extends string = never,
>({
	open,
	onAfterClose,
	title,
	formLabel,
	kindLabel,
	kinds,
	initialKind,
	confirmLabel,
	pendingLabel,
	shape: shapeChoice,
	onCreate,
	onCancel,
}: SetCreationDialogProps<Kind, Shape>) {
	const id = useId()
	const nameInput = useRef<HTMLInputElement>(null)
	const [name, setName] = useState('')
	const [kind, setKind] = useState(initialKind)
	const [shape, setShape] = useState(shapeChoice?.initial)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')
	const working = useRef(false)
	const request = useRef<{ id: string; content: string } | null>(null)
	useUnsavedDraft({
		dirty:
			name.length > 0 ||
			kind !== initialKind ||
			shape !== shapeChoice?.initial,
		pending: busy,
	})

	async function save(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault()
		if (!open || working.current) return
		if (!name.trim()) {
			setError('Enter a set name.')
			return
		}
		const content = JSON.stringify({ name: name.trim(), kind, shape })
		if (request.current?.content !== content)
			request.current = { id: crypto.randomUUID(), content }
		working.current = true
		setBusy(true)
		setError('')
		try {
			await onCreate(request.current.id, name.trim(), kind, shape)
		} catch (cause) {
			setError(errorMessage(cause, 'Unable to create the set.'))
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
				<ChoiceField
					id={`${id}-kind`}
					label={kindLabel}
					options={kinds}
					value={kind}
					disabled={busy || !open}
					onChange={setKind}
				/>
				{shapeChoice && shape !== undefined && (
					<ChoiceField
						id={`${id}-shape`}
						label={shapeChoice.label}
						options={shapeChoice.options}
						value={shape}
						disabled={busy || !open}
						onChange={setShape}
					/>
				)}
			</AdminForm>
		</ConfirmDialog>
	)
}
