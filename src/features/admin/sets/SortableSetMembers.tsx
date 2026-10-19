import { faGripVertical, faSquareMinus } from '@fortawesome/pro-solid-svg-icons'
import { useId, useRef, useState, type ReactNode } from 'react'
import {
	AdminIconButton,
	AdminMemberList,
	AdminMemberRow,
} from '@/features/admin/common'
import styles from './SortableSetMembers.module.css'

export interface SortableMember {
	readonly id: string
	readonly name: string
}

// Staged drag/keyboard ordering; the owner saves the order explicitly.
export default function SortableSetMembers<T extends SortableMember>({
	members,
	noun,
	disabled,
	preview,
	children,
	onReorder,
	onRemove,
}: {
	readonly members: readonly T[]
	readonly noun: string
	readonly disabled: boolean
	readonly preview?: (member: T) => ReactNode
	readonly children: (member: T, index: number) => ReactNode
	readonly onReorder: (ids: string[]) => void
	readonly onRemove: (id: string) => void
}) {
	const helpId = useId()
	const [dragging, setDragging] = useState<string | null>(null)
	const [announcement, setAnnouncement] = useState('')
	const drag = useRef<{
		id: string
		pointerId: number
		original: string[]
	} | null>(null)
	const list = useRef<HTMLDivElement>(null)

	function cancelDrag() {
		if (!drag.current) return
		onReorder(drag.current.original)
		drag.current = null
		setDragging(null)
		setAnnouncement('Reordering canceled.')
	}

	function move(id: string, destination: number) {
		const ids = members.map(member => member.id)
		const index = ids.indexOf(id)
		if (
			index < 0 ||
			destination < 0 ||
			destination >= ids.length ||
			index === destination
		)
			return
		ids.splice(index, 1)
		ids.splice(destination, 0, id)
		onReorder(ids)
		setAnnouncement(
			`${members[index].name} moved to position ${destination + 1} of ${ids.length}. Order not saved.`,
		)
	}

	return (
		<div
			ref={list}
			onPointerMove={event => {
				if (disabled || drag.current?.pointerId !== event.pointerId)
					return
				const target = document
					.elementFromPoint(event.clientX, event.clientY)
					?.closest<HTMLElement>('[data-member-id]')
				if (!target || !event.currentTarget.contains(target)) return
				const destination = members.findIndex(
					value => value.id === target.dataset.memberId,
				)
				move(drag.current.id, destination)
			}}
			onPointerUp={event => {
				if (drag.current?.pointerId !== event.pointerId) return
				drag.current = null
				setDragging(null)
				event.currentTarget.releasePointerCapture(event.pointerId)
			}}
			onPointerCancel={event => {
				if (drag.current?.pointerId === event.pointerId) cancelDrag()
			}}
			onLostPointerCapture={event => {
				if (drag.current?.pointerId === event.pointerId) cancelDrag()
			}}
		>
			<p id={helpId} className="visually-hidden">
				Drag the handles to reorder {noun}. With a handle focused, use
				Up/Down or Home/End. Choose Save when finished.
			</p>
			<AdminMemberList>
				{members.map((member, index) => (
					<AdminMemberRow
						key={member.id}
						data-member-id={member.id}
						className={`${styles.sortableMember} ${dragging === member.id ? styles.draggingMember : ''}`}
						preview={preview?.(member)}
						actions={
							<>
								<AdminIconButton
									icon={faGripVertical}
									label={`Reorder ${member.name}`}
									aria-describedby={helpId}
									className={styles.dragHandle}
									disabled={disabled || members.length < 2}
									onKeyDown={event => {
										if (
											event.key === 'Escape' &&
											drag.current
										) {
											event.preventDefault()
											const pointerId =
												drag.current.pointerId
											cancelDrag()
											list.current?.releasePointerCapture(
												pointerId,
											)
											return
										}
										if (disabled || drag.current) return
										const destination =
											event.key === 'ArrowUp'
												? index - 1
												: event.key === 'ArrowDown'
													? index + 1
													: event.key === 'Home'
														? 0
														: event.key === 'End'
															? members.length - 1
															: null
										if (destination === null) return
										event.preventDefault()
										move(member.id, destination)
									}}
									onPointerDown={event => {
										if (
											disabled ||
											drag.current ||
											!event.isPrimary ||
											event.button !== 0
										)
											return
										drag.current = {
											id: member.id,
											pointerId: event.pointerId,
											original: members.map(
												value => value.id,
											),
										}
										event.currentTarget.focus()
										list.current?.setPointerCapture(
											event.pointerId,
										)
										setDragging(member.id)
									}}
								/>
								<AdminIconButton
									icon={faSquareMinus}
									tone="delete"
									label={`Remove ${member.name} from set`}
									disabled={disabled || dragging !== null}
									onClick={() => onRemove(member.id)}
								/>
							</>
						}
					>
						{children(member, index)}
					</AdminMemberRow>
				))}
			</AdminMemberList>
			<span className="visually-hidden" role="status">
				{announcement}
			</span>
		</div>
	)
}
