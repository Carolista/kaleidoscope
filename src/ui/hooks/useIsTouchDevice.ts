import { useEffect, useState } from 'react'

// Treat a device as touch-primary if it has no hover capability or a coarse
// pointer (covers touchscreens; excludes mouse/trackpad devices, including
// hybrid laptops that happen to also have a touchscreen).
const TOUCH_QUERY = '(hover: none), (pointer: coarse)'

function matchesTouchQuery(): boolean {
	if (typeof window === 'undefined' || !window.matchMedia) return false
	return window.matchMedia(TOUCH_QUERY).matches
}

// Reactive so a hybrid device (e.g. a touchscreen laptop with a mouse
// plugged in/out) is re-evaluated rather than frozen at its first reading.
export function useIsTouchDevice(): boolean {
	const [isTouch, setIsTouch] = useState(matchesTouchQuery)

	useEffect(() => {
		if (typeof window === 'undefined' || !window.matchMedia) return

		const query = window.matchMedia(TOUCH_QUERY)
		const handleChange = () => setIsTouch(query.matches)

		query.addEventListener('change', handleChange)
		return () => query.removeEventListener('change', handleChange)
	}, [])

	return isTouch
}
