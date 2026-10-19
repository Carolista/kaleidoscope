import { faGripVertical, faSquareMinus } from '@fortawesome/pro-solid-svg-icons'
import { useId, useRef, useState } from 'react'
import type { DraftSet } from '../../services/puzzleSets'
import HexPuzzleBoard from '../puzzle/HexPuzzleBoard'
import AdminIconButton from './AdminIconButton'
import { AdminMemberList, AdminMemberRow } from './AdminLayout'
import styles from './AdminPortal.module.css'

export default function PuzzleSetMembers({
	members,
	disabled,
	onReorder,
	onRemove,
}: {
	readonly members: DraftSet['members']
	readonly disabled: boolean
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
		const ids = members.map(member => member.puzzleId)
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
					?.closest<HTMLElement>('[data-puzzle-id]')
				if (!target || !event.currentTarget.contains(target)) return
				const destination = members.findIndex(
					value => value.puzzleId === target.dataset.puzzleId,
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
			<p id={helpId}>
				Drag the handles to reorder puzzles. With a handle focused, use
				Up/Down or Home/End. Choose Save order when finished.
			</p>
			<AdminMemberList>
				{members.map((member, index) => (
					<AdminMemberRow
						key={member.puzzleId}
						data-puzzle-id={member.puzzleId}
						className={`${styles.sortableMember} ${dragging === member.puzzleId ? styles.draggingMember : ''}`}
						preview={
							<div
								className={styles.setMemberThumbnail}
								aria-hidden="true"
							>
								{member.preview ? (
									<HexPuzzleBoard
										target
										radius={member.preview.radius}
										colors={member.preview.target}
									/>
								) : (
									<span>Preview unavailable</span>
								)}
							</div>
						}
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
										move(member.puzzleId, destination)
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
											id: member.puzzleId,
											pointerId: event.pointerId,
											original: members.map(
												value => value.puzzleId,
											),
										}
										event.currentTarget.focus()
										list.current?.setPointerCapture(
											event.pointerId,
										)
										setDragging(member.puzzleId)
									}}
								/>
								<AdminIconButton
									icon={faSquareMinus}
									className={styles.minus}
									label={`Remove ${member.name} from set`}
									disabled={disabled || dragging !== null}
									onClick={() => onRemove(member.puzzleId)}
								/>
							</>
						}
					>
						{index + 1}. {member.name}
					</AdminMemberRow>
				))}
			</AdminMemberList>
			<span className={styles.reorderAnnouncement} role="status">
				{announcement}
			</span>
		</div>
	)
}
