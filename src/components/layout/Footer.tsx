import styles from './Footer.module.css'

function Footer() {
	const currentYear = new Date().getFullYear()
	return (
		<footer>
			<div className={styles.copyright}>
				<p>&copy;{currentYear} Caroline R. Jones</p>
				<p className={styles.reserved}>All rights reserved.</p>
			</div>
		</footer>
	)
}

export default Footer
