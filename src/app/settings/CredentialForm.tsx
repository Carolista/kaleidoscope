import {
	useEffect,
	useRef,
	useState,
	type ReactNode,
	type SubmitEvent,
} from 'react'
import { Button } from '@/ui/components'
import type { AuthResult } from '@/features/account'
import styles from './CredentialForm.module.css'

// The shared shell of the change email and change password forms: fields supplied
// by the caller, a Cancel/Save pair, and the pending and error states. `onSubmit`
// returns a message when the values are not worth sending.
export default function CredentialForm({
	label,
	children,
	onSubmit,
	onSaved,
	onCancel,
}: {
	readonly label: string
	readonly children: (pending: boolean) => ReactNode
	readonly onSubmit: (values: FormData) => string | Promise<AuthResult>
	readonly onSaved: () => void
	readonly onCancel: () => void
}) {
	const formRef = useRef<HTMLFormElement>(null)
	// A result that arrives after the form is gone (dialog closed) is dropped.
	const mounted = useRef(true)
	const [pending, setPending] = useState(false)
	const [error, setError] = useState('')

	useEffect(() => {
		mounted.current = true
		formRef.current?.querySelector('input')?.focus()
		return () => {
			mounted.current = false
		}
	}, [])

	async function submit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault()
		setError('')
		const outcome = onSubmit(new FormData(event.currentTarget))
		if (typeof outcome === 'string') {
			setError(outcome)
			return
		}
		setPending(true)
		const result = await outcome
		if (!mounted.current) return
		if (result.status === 'error') {
			setError(result.message)
			setPending(false)
		} else {
			onSaved()
		}
	}

	return (
		<form
			ref={formRef}
			className={styles.form}
			aria-label={label}
			onSubmit={event => void submit(event)}
		>
			{children(pending)}
			{error && (
				<p className={styles.error} role="alert">
					{error}
				</p>
			)}
			<div className={styles.buttons}>
				<Button onClick={onCancel} disabled={pending}>
					Cancel
				</Button>
				<Button type="submit" variant="primary" disabled={pending}>
					{pending ? 'Saving…' : 'Save'}
				</Button>
			</div>
		</form>
	)
}
