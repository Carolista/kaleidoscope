import { useId } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, Modal, ModalHeader } from '@/ui/components'
import { MODES, type Mode } from './modes'
import styles from './ModeDialog.module.css'

const ORDER: readonly Mode[] = ['home', 'zen', 'puzzle']

const NAMES: Readonly<Record<Mode, string>> = {
	home: 'Home',
	zen: 'Zen Mode',
	puzzle: 'Puzzle Mode',
}

// Where to go next. The page hosts it, so it does not inherit the header's sizing.
export default function ModeDialog({
	open,
	mode,
	onSelect,
	onClose,
}: {
	readonly open: boolean
	readonly mode: Mode
	readonly onSelect: (mode: Mode) => void
	readonly onClose: () => void
}) {
	const titleId = useId()
	return (
		<Modal
			open={open}
			onClose={onClose}
			labelledBy={titleId}
			className={styles.dialog}
			header={
				<ModalHeader
					title="Choose a mode"
					titleId={titleId}
					closeLabel="Close mode picker"
					onClose={onClose}
				/>
			}
		>
			<div className={styles.options}>
				{ORDER.map(option => (
					<Button
						key={option}
						variant={option === mode ? 'solid' : 'outline'}
						className={styles.option}
						aria-current={option === mode ? 'true' : undefined}
						onClick={() => {
							if (option !== mode) onSelect(option)
							onClose()
						}}
					>
						<FontAwesomeIcon
							icon={MODES[option].icon}
							className={styles.icon}
							aria-hidden="true"
						/>
						{NAMES[option]}
					</Button>
				))}
			</div>
		</Modal>
	)
}
