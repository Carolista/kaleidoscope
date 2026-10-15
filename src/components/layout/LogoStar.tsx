import { useEffect, useRef } from 'react'
import styles from './LogoStar.module.css'

interface LogoStarProps {
	readonly onSpinComplete?: () => void
}

function LogoStar({ onSpinComplete }: LogoStarProps) {
	const starRef = useRef<HTMLImageElement>(null)

	useEffect(() => {
		const star = starRef.current
		if (!star || !onSpinComplete) return

		star.addEventListener('animationend', onSpinComplete)
		return () => star.removeEventListener('animationend', onSpinComplete)
	}, [onSpinComplete])

	return (
		<img
			ref={starRef}
			className={styles.star}
			src={`${import.meta.env.BASE_URL}favicon.svg`}
			alt=""
			aria-hidden="true"
		/>
	)
}

export default LogoStar
