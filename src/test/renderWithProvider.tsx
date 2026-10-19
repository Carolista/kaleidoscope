import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { ZenStateProvider } from '@/features/zen/state'

// Wraps `render()` with the real `ZenStateProvider`, since nearly every
// component reads from app state via context.
export function renderWithProvider(ui: ReactElement) {
	return render(ui, { wrapper: ZenStateProvider })
}
