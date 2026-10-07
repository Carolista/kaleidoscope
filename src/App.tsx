import HexGrid from './components/HexGrid'
import styles from './App.module.css'

function App() {
  return (
    <main className={styles.app}>
      <h1 className={styles.title}>Kaleidoscope</h1>
      <HexGrid />
    </main>
  )
}

export default App
