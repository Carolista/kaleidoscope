import { lazy, Suspense, useEffect, useState } from 'react'
import App from './App'
import { AppStateProvider } from './state/AppContext'

const AdminPortal = lazy(() => import('./components/admin/AdminPortal'))

export default function AppEntry() {
	const [admin, setAdmin] = useState(() => window.location.hash === '#/admin')
	useEffect(() => {
		const update = () => setAdmin(window.location.hash === '#/admin')
		window.addEventListener('hashchange', update)
		return () => window.removeEventListener('hashchange', update)
	}, [])
	return admin ? (
		<Suspense fallback={<p role="status">Loading admin sign-in…</p>}>
			<AdminPortal />
		</Suspense>
	) : (
		<AppStateProvider>
			<App />
		</AppStateProvider>
	)
}
