import type { Ref } from 'react'
import styles from './Header.module.css'
import { LogoStar } from '@shared'

interface HeaderProps {
	readonly titleRef?: Ref<HTMLHeadingElement>
	readonly isOpening?: boolean
	readonly isMoving?: boolean
	readonly onStarSpinComplete?: () => void
}

function Header({
	titleRef,
	isOpening = false,
	isMoving = false,
	onStarSpinComplete,
}: HeaderProps) {
	const titleClasses = [
		styles.title,
		isOpening && styles.openingTitle,
		isMoving && styles.movingTitle,
	]
		.filter(Boolean)
		.join(' ')

	return (
		<header>
			<h1
				ref={titleRef}
				className={titleClasses}
				aria-label="Kaleidoscope"
			>
				<span className={styles.letters} aria-hidden="true">
					KALEID
				</span>
				<LogoStar
					className={styles.star}
					onSpinComplete={onStarSpinComplete}
				/>
				<span className={styles.letters} aria-hidden="true">
					SCOPE
				</span>
			</h1>
		</header>
	)
}

export default Header
