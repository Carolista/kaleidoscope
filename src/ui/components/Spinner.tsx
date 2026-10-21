import LogoStar from './LogoStar'
import styles from './Spinner.module.css'

function Spinner() {
	return <LogoStar animation="pulse" className={styles.spinner} />
}

export default Spinner
