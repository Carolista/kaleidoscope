import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { AppStateProvider } from '../state/AppContext'

/** Renders a component wrapped in the real `AppStateProvider`, since nearly every component reads from app state. */
export function renderWithProvider(ui: ReactElement) {
	return render(ui, { wrapper: AppStateProvider })
}
