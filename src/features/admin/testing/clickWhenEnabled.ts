import { fireEvent, screen, waitFor } from '@testing-library/react'
import { expect } from 'vitest'

// Many admin actions render disabled until their catalog finishes loading, and
// a click on a disabled button is silently ignored. Wait for it to be usable.
export async function clickWhenEnabled(name: string | RegExp) {
	const button = await screen.findByRole('button', { name })
	await waitFor(() => expect(button).toBeEnabled())
	fireEvent.click(button)
	return button
}
