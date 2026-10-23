import { createContext, useContext } from 'react'
import type { PlayerContent } from './playerContent'

export const PlayerContentContext = createContext<PlayerContent | null>(null)

export function usePlayerContent(): PlayerContent {
	const content = useContext(PlayerContentContext)
	if (!content)
		throw new Error(
			'usePlayerContent must be used within a PlayerContentProvider',
		)
	return content
}
