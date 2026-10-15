import styles from './LogoStar.module.css'

function LogoStar() {
	return (
		<img
			className={styles.star}
			src={`${import.meta.env.BASE_URL}favicon.svg`}
			alt=""
			aria-hidden="true"
		/>
	)
}

export default LogoStar
