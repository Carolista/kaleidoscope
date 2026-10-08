import HexGrid from './components/HexGrid'
import SchemePicker from './components/SchemePicker'
import ColorOptions from './components/ColorOptions'
import styles from './App.module.css'

function App() {
  return (
    <main className={styles.app}>
      <h1 className={styles.title}>Kaleidoscope</h1>
      <div className={styles.layout}>
        <section className={styles.controls} aria-label="Color controls">
          <div className={styles.controlsRow}>
            <SchemePicker />
            <ColorOptions />
          </div>
        </section>
        <section className={styles.display}>
          <HexGrid />
        </section>
      </div>
    </main>
  )
}

export default App
