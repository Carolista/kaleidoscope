import { lazy, Suspense, useEffect, useState } from 'react'
import App from './App'
import { AppStateProvider } from './state/AppContext'

const AdminPortal = lazy(() => import('./components/admin/AdminPortal'))

export default function AppEntry() {
	const [admin, setAdmin] = useState(() => window.location.hash === '#/admin')
	const [adminDirty, setAdminDirty] = useState(false)
	useEffect(() => {
		const update = (event: HashChangeEvent) => {
			const nextAdmin = window.location.hash === '#/admin'
			if (
				admin &&
				!nextAdmin &&
				adminDirty &&
				!window.confirm('Discard unsaved puzzle changes?')
			) {
				window.history.replaceState(null, '', event.oldURL)
				return
			}
			setAdmin(nextAdmin)
		}
		window.addEventListener('hashchange', update)
		return () => window.removeEventListener('hashchange', update)
	}, [admin, adminDirty])
	return admin ? (
		<Suspense fallback={<p role="status">Loading admin sign-in…</p>}>
			<AdminPortal onDirtyChange={setAdminDirty} />
		</Suspense>
	) : (
		<AppStateProvider>
			<App />
		</AppStateProvider>
	)
}
