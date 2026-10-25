import { useSyncExternalStore } from 'react'
import {
	faBorderAll,
	faSquare,
} from '@fortawesome/sharp-duotone-solid-svg-icons'
import type { IconButtonProps } from '@/ui/components'

// Whether a puzzle's target (and the peek overlay that shows it over the board)
// draws lines between its tiles. On small screens the lines can blur the
// colors together. A device preference, remembered like the image export's
// grid-lines choice; the board's own lines stay, since they show the empty tiles.
const STORAGE_KEY = 'kaleidoscope:puzzle:targetGridLines'

const listeners = new Set<() => void>()
// Holds the choice for the visit when storage is unavailable (e.g. private browsing).
let fallback: boolean | null = null

export function getTargetGridLines(): boolean {
	try {
		const saved = localStorage.getItem(STORAGE_KEY)
		if (saved !== null) return saved !== 'false'
	} catch {
		// Fall through to the visit's own choice.
	}
	return fallback ?? true
}

export function saveTargetGridLines(show: boolean): void {
	fallback = show
	try {
		localStorage.setItem(STORAGE_KEY, String(show))
	} catch {
		// Losing the preference isn't worth crashing the app over.
	}
	for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
	listeners.add(listener)
	// Another tab changing it.
	const onStorage = (event: StorageEvent) => {
		if (event.key === STORAGE_KEY || event.key === null) listener()
	}
	window.addEventListener('storage', onStorage)
	return () => {
		listeners.delete(listener)
		window.removeEventListener('storage', onStorage)
	}
}

// The preference and a way to change it, shared by everything that shows it.
export function useTargetGridLines(): readonly [
	boolean,
	(show: boolean) => void,
] {
	const show = useSyncExternalStore(subscribe, getTargetGridLines, () => true)
	return [show, saveTargetGridLines]
}

// Props for an icon button that toggles the preference, to spread into
// whichever button style a screen uses among its other actions.
export function useTargetGridToggle(): Pick<
	IconButtonProps,
	'icon' | 'label' | 'aria-pressed' | 'onClick'
> {
	const [show, setShow] = useTargetGridLines()
	return {
		icon: show ? faBorderAll : faSquare,
		label: 'Grid lines on the target',
		'aria-pressed': show,
		onClick: () => setShow(!show),
	}
}
