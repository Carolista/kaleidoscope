import styles from './Header.module.css'
import LogoStar from './LogoStar'

function Header() {
	return (
		<header>
			<h1 className={styles.title} aria-label="Kaleidoscope">
				<span className={styles.letters} aria-hidden="true">
					KALEID
				</span>
				<LogoStar />
				<span className={styles.letters} aria-hidden="true">
					SCOPE
				</span>
			</h1>
		</header>
	)
}

export default Header
