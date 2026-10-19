import { useEffect, useRef } from 'react'
import styles from './LogoStar.module.css'

interface LogoStarProps {
	readonly animation?: 'arrive' | 'pulse'
	readonly className?: string
	readonly onSpinComplete?: () => void
}

function LogoStar({
	animation = 'arrive',
	className,
	onSpinComplete,
}: LogoStarProps) {
	const starRef = useRef<HTMLImageElement>(null)

	useEffect(() => {
		const star = starRef.current
		if (!star || animation !== 'arrive' || !onSpinComplete) return

		star.addEventListener('animationend', onSpinComplete)
		return () => star.removeEventListener('animationend', onSpinComplete)
	}, [animation, onSpinComplete])

	return (
		<img
			ref={starRef}
			className={[styles.star, styles[animation], className]
				.filter(Boolean)
				.join(' ')}
			src={`${import.meta.env.BASE_URL}favicon.svg`}
			alt=""
			aria-hidden="true"
		/>
	)
}

export default LogoStar
