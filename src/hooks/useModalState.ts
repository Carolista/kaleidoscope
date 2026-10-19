import { useCallback, useRef, useState } from 'react'

export default function useModalState<Value>() {
	const [value, setValue] = useState<Value | null>(null)
	const [open, setOpen] = useState(false)
	const afterClose = useRef<(() => void) | undefined>(undefined)
	const change = useCallback((next: Value | null, onClosed?: () => void) => {
		afterClose.current = onClosed
		if (next !== null) setValue(next)
		setOpen(next !== null)
	}, [])
	const onAfterClose = useCallback(() => {
		setValue(null)
		const callback = afterClose.current
		afterClose.current = undefined
		callback?.()
	}, [])

	// Retain the action's content until the native dialog finishes its exit.
	return [value, change, { open, onAfterClose }] as const
}
