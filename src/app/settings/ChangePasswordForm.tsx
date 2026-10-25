import { FormField, Input } from '@/ui/components'
import { useAccount } from '@/features/account'
import CredentialForm from './CredentialForm'

export default function ChangePasswordForm({
	onSaved,
	onCancel,
}: {
	readonly onSaved: () => void
	readonly onCancel: () => void
}) {
	const account = useAccount()

	function submit(values: FormData) {
		const newPassword = String(values.get('newPassword') ?? '')
		if (newPassword !== String(values.get('confirmPassword') ?? '')) {
			return "The passwords don't match."
		}
		return account.changePassword({
			currentPassword: String(values.get('currentPassword') ?? ''),
			newPassword,
		})
	}

	return (
		<CredentialForm
			label="Change password"
			onSubmit={submit}
			onSaved={onSaved}
			onCancel={onCancel}
		>
			{pending => (
				<>
					<FormField label="Current password">
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
					<FormField
						label="New password"
						help="At least 8 characters."
					>
						{field => (
							<Input
								{...field}
								name="newPassword"
								type="password"
								autoComplete="new-password"
								minLength={8}
								required
								disabled={pending}
							/>
						)}
					</FormField>
					<FormField label="Confirm new password">
						{field => (
							<Input
								{...field}
								name="confirmPassword"
								type="password"
								autoComplete="new-password"
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
