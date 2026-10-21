import type { Ref } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPaintbrush, faPuzzlePiece } from '@fortawesome/pro-solid-svg-icons'
import styles from './Header.module.css'
import { LogoStar } from '@/ui/components'

interface HeaderProps {
	readonly titleRef?: Ref<HTMLHeadingElement>
	readonly isOpening?: boolean
	readonly isMoving?: boolean
	readonly onStarSpinComplete?: () => void
	readonly mode?: 'zen' | 'puzzle'
	readonly onModeChange?: (mode: 'zen' | 'puzzle') => void
}

function Header({
	titleRef,
	isOpening = false,
	isMoving = false,
	onStarSpinComplete,
	mode = 'zen',
	onModeChange,
}: HeaderProps) {
	const titleClasses = [
		styles.title,
		isOpening && styles.openingTitle,
		isMoving && styles.movingTitle,
	]
		.filter(Boolean)
		.join(' ')

	return (
		<header className={styles.header}>
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
			{onModeChange && (
				<nav
					aria-label="Play mode"
					className={`${styles.modeSwitch}${isOpening ? ` ${styles.openingSwitch}` : ''}`}
				>
					<button
						type="button"
						aria-label="Zen Mode"
						title="Zen Mode"
						aria-pressed={mode === 'zen'}
						onClick={() => onModeChange('zen')}
						disabled={isOpening}
					>
						<FontAwesomeIcon
							icon={faPaintbrush}
							aria-hidden="true"
						/>
					</button>
					<button
						type="button"
						aria-label="Puzzle Mode"
						title="Puzzle Mode"
						aria-pressed={mode === 'puzzle'}
						onClick={() => onModeChange('puzzle')}
						disabled={isOpening}
					>
						<FontAwesomeIcon
							icon={faPuzzlePiece}
							aria-hidden="true"
						/>
					</button>
				</nav>
			)}
		</header>
	)
}

export default Header
