import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppStateProvider } from '../state/AppContext'
import EditableAreaToggle from './EditableAreaToggle'
import { useIsTouchDevice } from '../utils/useIsTouchDevice'

vi.mock('../utils/useIsTouchDevice')
const mockUseIsTouchDevice = vi.mocked(useIsTouchDevice)

describe('EditableAreaToggle', () => {
	it('renders nothing on non-touch devices', () => {
		mockUseIsTouchDevice.mockReturnValue(false)
		const { container } = render(<EditableAreaToggle />, {
			wrapper: AppStateProvider,
		})
		expect(container).toBeEmptyDOMElement()
	})

	it('labels itself with the destination state, and flips the label/icon on click', async () => {
		mockUseIsTouchDevice.mockReturnValue(true)
		const user = userEvent.setup()
		render(<EditableAreaToggle />, { wrapper: AppStateProvider })

		// Defaults on, so the destination is hiding it.
		const button = screen.getByRole('button', {
			name: 'Hide editable area',
		})

		await user.click(button)
		expect(
			screen.getByRole('button', { name: 'Show editable area' }),
		).toBeInTheDocument()

		await user.click(screen.getByRole('button'))
		expect(
			screen.getByRole('button', { name: 'Hide editable area' }),
		).toBeInTheDocument()
	})
})
