import { faSquareCheck } from '@fortawesome/sharp-duotone-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect, useRef } from 'react'
import { useDuotoneIconTint } from '@/hooks/useDuotoneIconTint'
import styles from './Checkbox.module.css'

export interface CheckboxProps {
	readonly label: string
	readonly checked: boolean
	readonly onChange: (checked: boolean) => void
	readonly className?: string
	readonly hideLabel?: boolean
	readonly disabled?: boolean
	readonly indeterminate?: boolean
	readonly plain?: boolean
}

function ThemedCheck() {
	const duotoneTint = useDuotoneIconTint()
	return (
		<FontAwesomeIcon
			icon={faSquareCheck}
			aria-hidden="true"
			style={duotoneTint(faSquareCheck)}
		/>
	)
}

function Checkbox({
	label,
	checked,
	onChange,
	className,
	hideLabel = false,
	disabled = false,
	indeterminate = false,
	plain = false,
}: CheckboxProps) {
	const input = useRef<HTMLInputElement>(null)
	useEffect(() => {
		if (input.current) input.current.indeterminate = indeterminate
	}, [indeterminate])

	return (
		<label
			className={[styles.label, disabled && styles.disabled, className]
				.filter(Boolean)
				.join(' ')}
		>
			<span
				className={
					checked && !indeterminate
						? styles.box
						: `${styles.box} ${styles.boxEmpty}`
				}
			>
				<input
					type="checkbox"
					ref={input}
					disabled={disabled}
					aria-label={hideLabel ? label : undefined}
					className={styles.input}
					checked={checked}
					onChange={event => onChange(event.target.checked)}
				/>
				{indeterminate ? (
					<span className={styles.mixed} aria-hidden="true" />
				) : (
					checked &&
					(plain ? (
						<FontAwesomeIcon
							icon={faSquareCheck}
							aria-hidden="true"
						/>
					) : (
						<ThemedCheck />
					))
				)}
			</span>
			{!hideLabel && label}
		</label>
	)
}

export default Checkbox
