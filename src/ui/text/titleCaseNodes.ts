import { Children, type ReactNode } from 'react'
import { toTitleCase } from './toTitleCase'

// Title-cases the text in a label. Icons and other elements pass through, and a
// label split across several strings reads as one title.
export function titleCaseNodes(children: ReactNode): ReactNode {
	let started = false
	return Children.map(children, child => {
		if (typeof child !== 'string' && typeof child !== 'number') return child
		const text = String(child)
		const result = toTitleCase(text, !started)
		if (text.trim()) started = true
		return result
	})
}
