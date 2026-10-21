import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import {
	managePalette,
	managePaletteGroup,
	readPalette,
	type CatalogPalette,
	loadPaletteUsage,
	type PaletteUsage,
	type PaletteGroup,
} from '@/features/admin/services'
import PaletteUsageDetails from './PaletteUsageDetails'
import {
	AdminFeedback,
	AdminSectionHeading,
	AdminForm,
	errorMessage,
} from '@/features/admin/common'
import PaletteSandbox from './PaletteSandbox'
import { useNavigationGuard, useUnsavedDraft } from '@/ui/navigation'
import { DraftRecoveryNotice, useDraftRecovery } from '@/features/admin/drafts'
import styles from './PaletteEditor.module.css'
import { releaseState } from './releaseState'
import { Button, FormField, Input, Loading } from '@/ui/components'

const fallbackError = 'Unable to manage palettes.'

interface PaletteSnapshot {
	readonly name: string
	readonly colors: readonly string[]
}

function parsePaletteSnapshot(raw: unknown): PaletteSnapshot | null {
	if (!raw || typeof raw !== 'object') return null
	const { name, colors } = raw as Record<string, unknown>
	if (
		typeof name !== 'string' ||
		!Array.isArray(colors) ||
		colors.length !== 5 ||
		colors.some(color => typeof color !== 'string')
	)
		return null
	return { name, colors: colors as string[] }
}

export default function PaletteEditor({
	client,
	initial,
	startingColors,
	targetGroup,
	onSaved,
	onCancel,
}: {
	readonly client: SupabaseClient<Database>
	readonly initial: CatalogPalette | null
	readonly startingColors: readonly string[]
	// New palettes are added to this draft group as they are created.
	readonly targetGroup?: PaletteGroup['row']
	readonly onSaved: (message: string) => void
	readonly onCancel: () => void
}) {
	const { requestNavigation } = useNavigationGuard()
	const [name, setName] = useState(initial?.name ?? '')
	const [colors, setColors] = useState<readonly string[]>(startingColors)
	const [error, setError] = useState('')
	const [pending, setPending] = useState<string | null>(null)
	const busy = pending !== null
	const working = useRef(false)
	const createRequest = useRef<{ id: string; content: string } | null>(null)
	const [usage, setUsage] = useState<PaletteUsage | null>(null)
	const [usageError, setUsageError] = useState('')
	const [usageLoading, setUsageLoading] = useState(!!initial)
	const readOnly = !!initial?.published_at || !!initial?.release_at
	const dirty =
		!readOnly &&
		(name !== (initial?.name ?? '') ||
			colors.some((color, index) => color !== startingColors[index]))
	const recovery = useDraftRecovery<PaletteSnapshot>({
		key: `palette:${initial?.id ?? `new:${targetGroup?.id ?? ''}`}`,
		dirty,
		snapshot: { name, colors },
		parse: parsePaletteSnapshot,
		onRestore: saved => {
			setName(saved.name)
			setColors(saved.colors)
		},
	})
	useUnsavedDraft({ dirty, pending: busy, discard: recovery.discard })
	const validColors =
		colors.length === 5 &&
		colors.every(color => /^#[0-9a-f]{6}$/i.test(color))
			? readPalette({ id: initial?.id ?? 'preview', name, colors }).colors
			: null
	useEffect(() => {
		if (!initial) return
		let active = true
		void loadPaletteUsage(client, initial.id)
			.then(next => {
				if (active) setUsage(next)
			})
			.catch((cause: unknown) => {
				if (active) setUsageError(errorMessage(cause, fallbackError))
			})
			.finally(() => {
				if (active) setUsageLoading(false)
			})
		return () => {
			active = false
		}
	}, [client, initial])

	async function save(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault()
		if (working.current || readOnly) return
		if (!validColors || !name.trim()) {
			setError('Enter a name and five six-digit hex colors.')
			return
		}
		working.current = true
		setPending('Saving palette…')
		setError('')
		try {
			const palette = { name: name.trim(), colors: validColors }
			if (initial) {
				await managePalette(client, {
					kind: 'update',
					previous: initial,
					palette,
				})
			} else {
				const content = JSON.stringify(palette)
				if (createRequest.current?.content !== content)
					createRequest.current = { id: crypto.randomUUID(), content }
				await managePalette(client, {
					kind: 'create',
					id: createRequest.current.id,
					palette,
				})
				if (targetGroup)
					await managePaletteGroup(client, targetGroup.id, {
						kind: 'assign',
						paletteIds: [createRequest.current.id],
					})
			}
			recovery.discard()
			onSaved(
				`Saved "${palette.name}" as a draft palette${!initial && targetGroup ? ` in "${targetGroup.name}"` : ''}.`,
			)
		} catch (cause) {
			setError(errorMessage(cause, fallbackError))
		} finally {
			working.current = false
			setPending(null)
		}
	}
	return (
		<section aria-labelledby="palette-editor-title">
			<h2 id="palette-editor-title">
				{initial
					? `${readOnly ? 'View' : 'Edit'} palette`
					: 'New palette'}
			</h2>
			{!initial && targetGroup && (
				<p>This palette will be added to "{targetGroup.name}".</p>
			)}
			{readOnly && (
				<p>{initial && releaseState(initial)} palette (read-only).</p>
			)}
			{!readOnly && (
				<DraftRecoveryNotice
					recovery={recovery}
					subject="this palette"
					replacesFields
				/>
			)}
			<AdminFeedback error={error} />
			{pending && <Loading label={pending} />}
			<div className={styles.editor}>
				<AdminForm
					onSubmit={save}
					aria-label={initial ? 'Edit palette' : 'Create palette'}
				>
					<div className={styles.nameRow}>
						<FormField label="Palette name" id="palette-name">
							{field => (
								<Input
									{...field}
									value={name}
									required
									disabled={busy || readOnly}
									onChange={event =>
										setName(event.target.value)
									}
								/>
							)}
						</FormField>
						<div className={styles.actions}>
							<Button
								disabled={busy}
								onClick={() => requestNavigation(onCancel)}
							>
								{readOnly ? 'Back' : 'Cancel'}
							</Button>
							{!readOnly && (
								<Button
									type="submit"
									variant="primary"
									disabled={
										busy ||
										!validColors ||
										!name.trim() ||
										(!!initial && !dirty)
									}
								>
									Save
								</Button>
							)}
						</div>
					</div>
					<fieldset
						className={styles.colors}
						disabled={busy || readOnly}
					>
						<legend>Ordered colors</legend>
						{colors.map((color, index) => {
							const valid = /^#[0-9a-f]{6}$/i.test(color)
							function update(value: string) {
								setColors(previous =>
									previous.map((entry, slot) =>
										slot === index ? value : entry,
									),
								)
							}
							return (
								<div className={styles.colorRow} key={index}>
									<label htmlFor={`palette-color-${index}`}>
										Color {index + 1}
									</label>
									{valid ? (
										<Input
											type="color"
											value={color}
											aria-label={`Pick color ${index + 1}`}
											onChange={event =>
												update(event.target.value)
											}
										/>
									) : (
										<span
											className={styles.invalidSwatch}
											aria-hidden="true"
										>
											?
										</span>
									)}
									<Input
										id={`palette-color-${index}`}
										value={color}
										required
										pattern="#[0-9A-Fa-f]{6}"
										aria-invalid={!valid}
										aria-describedby={
											!valid
												? `palette-color-error-${index}`
												: undefined
										}
										spellCheck={false}
										onChange={event =>
											update(event.target.value)
										}
									/>
									{!valid && (
										<span
											id={`palette-color-error-${index}`}
											className={styles.colorError}
										>
											Use # and six hex digits.
										</span>
									)}
								</div>
							)
						})}
					</fieldset>
				</AdminForm>
				<PaletteSandbox colors={validColors} />
			</div>
			{initial && (
				<section aria-label="Palette usage">
					<AdminSectionHeading
						id="palette-usage-title"
						title="Usage"
						level={3}
					/>
					{usageLoading && <Loading label="Loading palette usage…" />}
					{usageError && <p role="alert">{usageError}</p>}
					{usage && !usageLoading && !usageError && (
						<PaletteUsageDetails
							usage={usage}
							colors={validColors}
						/>
					)}
				</section>
			)}
		</section>
	)
}
