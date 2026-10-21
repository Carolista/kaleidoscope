import { useMemo, type ReactNode } from 'react'
import { DraftScopeContext } from './draftScope'

// Without this provider, editors simply don't persist drafts.
export default function DraftScopeProvider({
	userId,
	children,
}: {
	readonly userId: string
	readonly children: ReactNode
}) {
	const scope = useMemo(() => ({ userId }), [userId])
	return <DraftScopeContext value={scope}>{children}</DraftScopeContext>
}
