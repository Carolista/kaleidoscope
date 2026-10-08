import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { AppStateProvider } from '../state/AppContext'

// Wraps `render()` with the real `AppStateProvider`, since nearly every
// component reads from app state via context.
export function renderWithProvider(ui: ReactElement) {
	return render(ui, { wrapper: AppStateProvider })
}
