import { FormField, Input } from '@/ui/components'
import { useAccount } from '@/features/account'
import CredentialForm from './CredentialForm'

export default function ChangeEmailForm({
	onSaved,
	onCancel,
}: {
	readonly onSaved: () => void
	readonly onCancel: () => void
}) {
	const account = useAccount()

	function submit(values: FormData) {
		const email = String(values.get('email') ?? '').trim()
		if (email.toLowerCase() === account.email?.toLowerCase()) {
			return 'That is already your email address.'
		}
		return account.changeEmail({
			email,
			currentPassword: String(values.get('currentPassword') ?? ''),
		})
	}

	return (
		<CredentialForm
			label="Change email"
			onSubmit={submit}
			onSaved={onSaved}
			onCancel={onCancel}
		>
			{pending => (
				<>
					<FormField label="New email">
						{field => (
							<Input
								{...field}
								name="email"
								type="email"
								autoComplete="email"
								required
								disabled={pending}
							/>
						)}
					</FormField>
					<FormField
						label="Current password"
						help="We'll email a confirmation link to the new address."
					>
						{field => (
							<Input
								{...field}
								name="currentPassword"
								type="password"
								autoComplete="current-password"
								required
								disabled={pending}
							/>
						)}
					</FormField>
				</>
			)}
		</CredentialForm>
	)
}
