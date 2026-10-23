import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import type { PlayerContent } from '@/ui/content'
import { testContent } from './playerContent'
import { TestZenStateProvider } from './TestZenStateProvider'

// Wraps `render()` with the real `ZenStateProvider` over player content.
export function renderWithProvider(
	ui: ReactElement,
	content: PlayerContent = testContent,
) {
	return render(ui, {
		wrapper: ({ children }) => (
			<TestZenStateProvider content={content}>
				{children}
			</TestZenStateProvider>
		),
	})
}
