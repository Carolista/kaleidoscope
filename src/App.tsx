import type { CSSProperties } from 'react'
import HexGrid from './components/HexGrid'
import ColorOptions from './components/ColorOptions'
import SettingsButton from './components/SettingsButton'
import ResetButton from './components/ResetButton'
import { useAppState } from './state/useAppState'
import { getThemeColors } from './state/theme'
import styles from './App.module.css'

function App() {
  const { state } = useAppState()
  const { base, accent } = getThemeColors(state.darkMode)

  return (
    <main
      className={styles.app}
      style={{ '--base': base, '--accent': accent } as CSSProperties}
    >
      <h1 className={styles.title}>Kaleidoscope</h1>
      <div className={styles.topRow} role="group" aria-label="Color controls">
        <ColorOptions />
        <SettingsButton />
      </div>
      <HexGrid />
      <ResetButton />
    </main>
  )
}

export default App
