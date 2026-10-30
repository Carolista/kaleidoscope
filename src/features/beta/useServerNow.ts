import { useEffect, useState } from 'react'

// The server's current time, kept moving with the device's clock from the moment it was read
// and refreshed every 15 seconds, which is fine for a countdown shown in minutes.
export default function useServerNow(serverNow: number, localAt: number) {
	const offset = serverNow - localAt
	const [now, setNow] = useState(() => Date.now() + offset)
	useEffect(() => {
		const id = window.setInterval(() => setNow(Date.now() + offset), 15_000)
		return () => window.clearInterval(id)
	}, [offset])
	return now
}
