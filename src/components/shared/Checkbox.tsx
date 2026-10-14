import { faSquareCheck } from '@fortawesome/sharp-duotone-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useDuotoneIconTint } from '@hooks/useDuotoneIconTint'
import styles from './Checkbox.module.css'

export interface CheckboxProps {
	readonly label: string
	readonly checked: boolean
	readonly onChange: (checked: boolean) => void
	readonly className?: string
}

function Checkbox({ label, checked, onChange, className }: CheckboxProps) {
	const duotoneTint = useDuotoneIconTint()

	return (
		<label className={[styles.label, className].filter(Boolean).join(' ')}>
			<span
				className={
					checked ? styles.box : `${styles.box} ${styles.boxEmpty}`
				}
			>
				<input
					type="checkbox"
					className={styles.input}
					checked={checked}
					onChange={event => onChange(event.target.checked)}
				/>
				{checked && (
					<FontAwesomeIcon
						icon={faSquareCheck}
						aria-hidden="true"
						style={duotoneTint(faSquareCheck)}
					/>
				)}
			</span>
			{label}
		</label>
	)
}

export default Checkbox
