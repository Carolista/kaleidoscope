import { useIsTouchDevice } from '@/ui/hooks'
import { faImages, faXmark } from '@fortawesome/pro-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect, useId, useRef, useState, type DragEvent } from 'react'
import styles from './ScreenshotPicker.module.css'
import {
	isScreenshotType,
	MAX_SCREENSHOTS,
	SCREENSHOT_TYPES,
} from './screenshots'

export interface Attachment {
	readonly id: string
	readonly file: File
	// A temporary address for showing the file, which the picker releases when it is done.
	readonly previewUrl: string | null
}

let nextId = 0

function Thumbnail({ url }: { readonly url: string | null }) {
	return url ? (
		<img className={styles.thumbnail} src={url} alt="" />
	) : (
		<span className={styles.thumbnail} aria-hidden="true" />
	)
}

function previewUrl(file: File): string | null {
	return typeof URL.createObjectURL === 'function'
		? URL.createObjectURL(file)
		: null
}

function revoke(attachment: Attachment) {
	if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
}

// Screenshots to go with a report: dropped onto the area or chosen from the device's files,
// any number at a time up to the limit.
export default function ScreenshotPicker({
	value,
	onChange,
	disabled = false,
}: {
	readonly value: readonly Attachment[]
	readonly onChange: (value: readonly Attachment[]) => void
	readonly disabled?: boolean
}) {
	const inputId = useId()
	const [dragging, setDragging] = useState(false)
	const [message, setMessage] = useState('')
	// What is attached when the picker goes away, so its previews can be released.
	const latest = useRef(value)
	useEffect(() => {
		latest.current = value
	})
	useEffect(
		() => () => {
			latest.current.forEach(revoke)
		},
		[],
	)
	// Dragging a file onto the page is not something a phone or tablet does.
	const touch = useIsTouchDevice()
	const full = value.length >= MAX_SCREENSHOTS
	const inactive = disabled || full

	function add(files: readonly File[]) {
		const images = files.filter(file => isScreenshotType(file.type))
		const room = MAX_SCREENSHOTS - value.length
		const accepted = images.slice(0, room)
		const notes: string[] = []
		if (images.length < files.length)
			notes.push('Only PNG, JPEG, and WebP images can be attached.')
		if (images.length > accepted.length)
			notes.push(
				`You can attach only ${MAX_SCREENSHOTS} screenshots, so some were left out.`,
			)
		setMessage(notes.join(' '))
		if (accepted.length > 0)
			onChange([
				...value,
				...accepted.map(file => ({
					id: `shot-${nextId++}`,
					file,
					previewUrl: previewUrl(file),
				})),
			])
	}

	function drop(event: DragEvent<HTMLLabelElement>) {
		event.preventDefault()
		setDragging(false)
		if (!inactive) add(Array.from(event.dataTransfer.files))
	}

	return (
		<div className={styles.picker}>
			<label
				htmlFor={inputId}
				className={`${styles.zone}${dragging && !inactive ? ` ${styles.dragging}` : ''}${inactive ? ` ${styles.inactive}` : ''}`}
				onDragOver={event => {
					event.preventDefault()
					if (!inactive) setDragging(true)
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={drop}
			>
				<FontAwesomeIcon icon={faImages} size="2x" aria-hidden="true" />
				<span>
					{full
						? `The most you can attach is ${MAX_SCREENSHOTS} screenshots.`
						: touch
							? `Tap to choose up to ${MAX_SCREENSHOTS} screenshots from your photos or files.`
							: `Drag screenshots here (up to ${MAX_SCREENSHOTS} max), or click to choose files.`}
				</span>
				<input
					id={inputId}
					className={styles.input}
					type="file"
					multiple
					accept={SCREENSHOT_TYPES.join(',')}
					disabled={inactive}
					onChange={event => {
						add(Array.from(event.target.files ?? []))
						// So that choosing the same file again is noticed.
						event.target.value = ''
					}}
				/>
			</label>
			{message && (
				<p className={styles.message} role="alert">
					{message}
				</p>
			)}
			{value.length > 0 && (
				<ul className={styles.list} aria-label="Attached screenshots">
					{value.map(attachment => (
						<li key={attachment.id} className={styles.item}>
							<Thumbnail url={attachment.previewUrl} />
							<span className={styles.name}>
								{attachment.file.name}
							</span>
							<button
								type="button"
								className={styles.remove}
								aria-label={`Remove ${attachment.file.name}`}
								disabled={disabled}
								onClick={() => {
									revoke(attachment)
									setMessage('')
									onChange(
										value.filter(
											other => other.id !== attachment.id,
										),
									)
								}}
							>
								<FontAwesomeIcon
									icon={faXmark}
									aria-hidden="true"
								/>
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	)
}
