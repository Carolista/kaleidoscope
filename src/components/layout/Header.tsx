import styles from './Header.module.css'

function Header() {
	return (
		<header>
			<h1 className={styles.title} aria-label="Kaleidoscope">
				<span className={styles.letters} aria-hidden="true">
					KALEID
				</span>
				<img
					className={styles.star}
					src={`${import.meta.env.BASE_URL}favicon.svg`}
					alt=""
					aria-hidden="true"
				/>
				<span className={styles.letters} aria-hidden="true">
					SCOPE
				</span>
			</h1>
		</header>
	)
}

export default Header
