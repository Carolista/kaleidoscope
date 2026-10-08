import type { CSSProperties } from 'react'
import HexGrid from './components/HexGrid'
import SchemePicker from './components/SchemePicker'
import ColorOptions from './components/ColorOptions'
import DarkModeToggle from './components/DarkModeToggle'
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
      <div className={styles.layout}>
        <section className={styles.controls} aria-label="Color controls">
          <div className={styles.controlsRow}>
            <SchemePicker />
            <ColorOptions />
          </div>
          <DarkModeToggle />
        </section>
        <section className={styles.display}>
          <HexGrid />
        </section>
      </div>
    </main>
  )
}

export default App
