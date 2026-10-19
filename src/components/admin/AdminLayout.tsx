import type { ReactNode } from 'react'
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

export function AdminMemberRow({
	preview,
	children,
	actions,
}: {
	readonly preview?: ReactNode
	readonly children: ReactNode
	readonly actions: ReactNode
}) {
	return (
		<li className={styles.member}>
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
