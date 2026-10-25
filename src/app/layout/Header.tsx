import type { ReactNode, Ref } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import styles from './Header.module.css'
import { LogoStar } from '@/ui/components'
import { MODES, type Mode } from './modes'

interface HeaderProps {
	readonly titleRef?: Ref<HTMLHeadingElement>
	readonly isOpening?: boolean
	readonly isMoving?: boolean
	readonly onStarSpinComplete?: () => void
	readonly mode?: Mode
	// Makes the current mode a button; the page hosts the dialog it opens.
	readonly onOpenModes?: () => void
	// Makes the title a button that returns to the home screen.
	readonly onHome?: () => void
	// How far into its arrival spin the star already is (see LogoStar).
	readonly starElapsedMs?: number
	// Page-wide controls (e.g. settings), shown after the mode button.
	readonly actions?: ReactNode
}

function Header({
	titleRef,
	isOpening = false,
	isMoving = false,
	onStarSpinComplete,
	mode = 'zen',
	onOpenModes,
	onHome,
	starElapsedMs,
	actions,
}: HeaderProps) {
	const titleClasses = [
		styles.title,
		isOpening && styles.openingTitle,
		isMoving && styles.movingTitle,
	]
		.filter(Boolean)
		.join(' ')
	const lettering = (
		<>
			<span className={styles.letters} aria-hidden="true">
				KALEID
			</span>
			<LogoStar
				className={styles.star}
				onSpinComplete={onStarSpinComplete}
				elapsedMs={starElapsedMs}
			/>
			<span className={styles.letters} aria-hidden="true">
				SCOPE
			</span>
		</>
	)

	return (
		<header className={styles.header}>
			<h1
				ref={titleRef}
				className={titleClasses}
				aria-label="Kaleidoscope"
			>
				{onHome ? (
					<button
						type="button"
						className={styles.homeButton}
						aria-label="Home"
						title="Home"
						onClick={() => {
							// The title is not a control until it has settled into the header.
							if (!isOpening && !isMoving) onHome()
						}}
					>
						{lettering}
					</button>
				) : (
					lettering
				)}
			</h1>
			{onOpenModes && (
				<button
					type="button"
					className={`${styles.modeButton}${isOpening ? ` ${styles.openingSwitch}` : ''}`}
					aria-label={`Change mode, currently ${MODES[mode].label}`}
					title="Change mode"
					aria-haspopup="dialog"
					onClick={onOpenModes}
					disabled={isOpening}
				>
					<FontAwesomeIcon
						icon={MODES[mode].icon}
						className={
							mode === 'puzzle' ? styles.puzzleIcon : undefined
						}
						aria-hidden="true"
					/>
					<span className={styles.modeLabel} aria-hidden="true">
						{MODES[mode].label.toUpperCase()}
					</span>
				</button>
			)}
			{actions && (
				<div
					className={`${styles.actions}${isOpening ? ` ${styles.openingSwitch}` : ''}`}
				>
					{actions}
				</div>
			)}
		</header>
	)
}

export default Header
