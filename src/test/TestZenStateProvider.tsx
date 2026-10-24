import type { ReactNode } from 'react'
import { ZenStateProvider } from '@/features/zen/state'
import { PlayerProgressProvider, type PlayerContent } from '@/ui/content'
import { testContent } from './playerContent'

// The real `ZenStateProvider` over loaded player content, since nearly every
// component reads app state via context.
export function TestZenStateProvider({
	children,
	content = testContent,
}: {
	readonly children?: ReactNode
	readonly content?: PlayerContent
}) {
	return (
		<PlayerProgressProvider content={content}>
			<ZenStateProvider>{children}</ZenStateProvider>
		</PlayerProgressProvider>
	)
}
