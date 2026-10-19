import type { ComponentProps, ReactNode, SubmitEvent } from 'react'
import { faXmark } from '@fortawesome/pro-solid-svg-icons'
import { Button, Checkbox, FormField, Input } from '@shared'
import AdminIconButton from './AdminIconButton'
import styles from './AdminLayout.module.css'

export function AdminSectionHeading({
	id,
	title,
	level = 2,
	children,
}: {
	readonly id: string
	readonly title: ReactNode
	readonly level?: 2 | 3
	readonly children?: ReactNode
}) {
	const Heading = level === 2 ? 'h2' : 'h3'
	return (
		<div className={styles.heading}>
			<Heading id={id}>{title}</Heading>
			{children && <div className={styles.actions}>{children}</div>}
		</div>
	)
}

export function AdminFeedback({
	error,
	status,
}: {
	readonly error?: ReactNode
	readonly status?: ReactNode
}) {
	return (
		<>
			{error && <p role="alert">{error}</p>}
			{status && <p role="status">{status}</p>}
		</>
	)
}

export function AdminGallery({
	layout,
	children,
}: {
	readonly layout: 'puzzles' | 'palettes' | 'sets'
	readonly children: ReactNode
}) {
	return <ul className={`${styles.gallery} ${styles[layout]}`}>{children}</ul>
}

export function AdminSetCard({
	label,
	thumbnail,
	children,
	actions,
}: {
	readonly label: string
	readonly thumbnail: ReactNode
	readonly children: ReactNode
	readonly actions: ReactNode
}) {
	return (
		<li className={styles.setCard} aria-label={label}>
			<div className={styles.setThumbnail} aria-hidden="true">
				{thumbnail}
			</div>
			<div className={styles.setDetails}>{children}</div>
			<div className={styles.setCardActions}>{actions}</div>
		</li>
	)
}

// A catalog card: preview, centered details, then checkbox and actions.
export function AdminItemCard({
	label,
	preview,
	children,
	selectLabel,
	selected,
	selectDisabled,
	onSelect,
	actions,
}: {
	readonly label: string
	readonly preview: ReactNode
	readonly children: ReactNode
	readonly selectLabel: string
	readonly selected: boolean
	readonly selectDisabled?: boolean
	readonly onSelect: (selected: boolean) => void
	readonly actions: ReactNode
}) {
	return (
		<li
			className={styles.itemCard}
			aria-label={label}
			data-selected={selected}
		>
			<div className={styles.itemPreview}>{preview}</div>
			<div className={styles.itemDetails}>{children}</div>
			<div className={styles.itemFooter}>
				<Checkbox
					plain
					hideLabel
					label={selectLabel}
					className={styles.itemCheckbox}
					checked={selected}
					disabled={selectDisabled}
					onChange={onSelect}
				/>
				<div className={styles.itemActions}>{actions}</div>
			</div>
		</li>
	)
}

// Select-all for the shown cards, plus bulk icon actions once any are checked.
export function AdminSelectionBar({
	label,
	shown,
	checked,
	disabled,
	onSelectAll,
	onClear,
	children,
}: {
	readonly label: string
	readonly shown: number
	readonly checked: number
	readonly disabled: boolean
	readonly onSelectAll: (selected: boolean) => void
	readonly onClear: () => void
	readonly children: ReactNode
}) {
	if (!shown) return null
	const all = checked === shown
	return (
		<div className={styles.selectionBar}>
			<Checkbox
				plain
				label="Select all"
				checked={all}
				indeterminate={checked > 0 && !all}
				disabled={disabled}
				onChange={onSelectAll}
			/>
			{checked > 0 && (
				<div
					className={styles.bulkActions}
					role="group"
					aria-label={label}
				>
					{children}
					<AdminIconButton
						icon={faXmark}
						label="Clear selection"
						disabled={disabled}
						onClick={onClear}
					/>
				</div>
			)}
		</div>
	)
}

// Set name, an optional role/label control, and one Save for all staged edits.
export function AdminSetForm({
	label,
	nameId,
	name,
	disabled,
	readOnly = false,
	saveDisabled,
	onNameChange,
	onSave,
	children,
}: {
	readonly label: string
	readonly nameId: string
	readonly name: string
	readonly disabled: boolean
	readonly readOnly?: boolean
	readonly saveDisabled: boolean
	readonly onNameChange: (name: string) => void
	readonly onSave: () => void
	readonly children?: ReactNode
}) {
	return (
		<form
			className={styles.setForm}
			aria-label={label}
			onSubmit={(event: SubmitEvent<HTMLFormElement>) => {
				event.preventDefault()
				if (!readOnly) onSave()
			}}
		>
			<FormField id={nameId} label="Set name">
				{field => (
					<Input
						{...field}
						required
						value={name}
						disabled={disabled || readOnly}
						onChange={event => onNameChange(event.target.value)}
					/>
				)}
			</FormField>
			{children}
			{!readOnly && (
				<Button
					type="submit"
					variant="primary"
					disabled={disabled || saveDisabled || !name.trim()}
				>
					Save
				</Button>
			)}
		</form>
	)
}

export function AdminTag({ children }: { readonly children: ReactNode }) {
	return <span className={styles.tag}>{children}</span>
}

export function AdminMemberRow({
	preview,
	children,
	actions,
	...props
}: {
	readonly preview?: ReactNode
	readonly children: ReactNode
	readonly actions: ReactNode
} & Omit<ComponentProps<'li'>, 'children'>) {
	return (
		<li
			{...props}
			className={[styles.member, props.className]
				.filter(Boolean)
				.join(' ')}
		>
			{preview}
			<span className={styles.memberContent}>{children}</span>
			<div className={styles.memberActions}>{actions}</div>
		</li>
	)
}

export function AdminMemberList({
	children,
}: {
	readonly children: ReactNode
}) {
	return <ol className={styles.members}>{children}</ol>
}
