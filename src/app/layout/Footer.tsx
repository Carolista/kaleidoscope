import styles from './Footer.module.css'

function Footer() {
	const currentYear = new Date().getFullYear()
	return (
		<footer>
			<p className={styles.copyright}>
				&copy;{currentYear} Caroline R. Jones. All rights reserved.
			</p>
		</footer>
	)
}

export default Footer
