import { useEffect } from 'react'
import type { BetaApi } from './betaApi'
import { captureDevice } from './deviceInfo'

// Notes the device the tester has opened the page on, once as the page appears. It shows
// nothing, and a failure is not worth the tester's attention: it only feeds the admin's
// picture of which devices have been covered.
export default function DeviceRecorder({
	api,
	roundId,
}: {
	readonly api: BetaApi
	readonly roundId: string
}) {
	useEffect(() => {
		void api.recordDevice(roundId, captureDevice()).catch(() => undefined)
	}, [api, roundId])
	return null
}
