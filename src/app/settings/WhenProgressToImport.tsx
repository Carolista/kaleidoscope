import type { ReactNode } from 'react'
import { usePlayerProgress } from '@/ui/content'

// Renders its children only while guest progress on this device is still waiting
// to be imported.
export default function WhenProgressToImport({
	children,
}: {
	readonly children: ReactNode
}) {
	const { guestImport } = usePlayerProgress()
	return guestImport ? children : null
}
