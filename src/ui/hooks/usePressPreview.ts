import { useState } from 'react'
import type { MouseEvent, PointerEvent } from 'react'

// Previews locked content while a finger or pen is held on it. Mouse hover is left to CSS
// (`@media (hover: hover)`), and the preview ends on release, cancel (such as the start of a
// scroll), or leaving the element. The returned props go on the pressed element.
export function usePressPreview() {
	const [previewing, setPreviewing] = useState(false)
	const end = () => setPreviewing(false)
	return {
		'data-previewing': previewing || undefined,
		onPointerDown: (event: PointerEvent) => {
			if (event.pointerType !== 'mouse') setPreviewing(true)
		},
		onPointerUp: end,
		onPointerCancel: end,
		onPointerLeave: end,
		// A long press would otherwise open the browser's context menu mid-preview.
		onContextMenu: (event: MouseEvent) => event.preventDefault(),
	}
}
