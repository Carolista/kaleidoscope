import { useEffect, useState } from 'react'
import { captureDevice, type DeviceInfo } from './deviceInfo'

// The device's details, kept current as the window is resized or turned.
export default function useDeviceInfo(): DeviceInfo {
	const [info, setInfo] = useState(captureDevice)
	useEffect(() => {
		const update = () => setInfo(captureDevice())
		window.addEventListener('resize', update)
		return () => window.removeEventListener('resize', update)
	}, [])
	return info
}
