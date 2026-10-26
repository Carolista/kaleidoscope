import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
import '@fontsource/hurricane/400.css'
import '@fontsource/mr-dafoe/400.css'
import '@fontsource/righteous/400.css'
import '@fontsource/urbanist/200.css'
import '@fontsource/urbanist/400.css'
import '@fontsource/urbanist/600.css'
import '@fontsource/urbanist/400-italic.css'
import '@fontsource/urbanist/800.css'
import '@/app/index.css'
import AppEntry from '@/app/AppEntry'

// Icons are rendered via <FontAwesomeIcon>, which injects its own <svg>
// elements directly — importing the CSS above and disabling the library's
// automatic <style> injection avoids a redundant/duplicate stylesheet and
// the brief unstyled-icon flash it can cause on first paint.
config.autoAddCss = false

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<AppEntry />
	</StrictMode>,
)
