import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/900.css'
import '@fontsource/righteous/400.css'
import './index.css'
import App from './App.tsx'
import { AppStateProvider } from './state/AppContext.tsx'

// Icons are rendered via <FontAwesomeIcon>, which injects its own <svg>
// elements directly — importing the CSS above and disabling the library's
// automatic <style> injection avoids a redundant/duplicate stylesheet and
// the brief unstyled-icon flash it can cause on first paint.
config.autoAddCss = false

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<AppStateProvider>
			<App />
		</AppStateProvider>
	</StrictMode>,
)
