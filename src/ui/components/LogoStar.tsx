import { useEffect, useRef } from 'react'
import styles from './LogoStar.module.css'

interface LogoStarProps {
	readonly animation?: 'arrive' | 'pulse'
	readonly className?: string
	readonly onSpinComplete?: () => void
	// Joins an arrival spin already under way, so a remount does not restart it.
	readonly elapsedMs?: number
}

function LogoStar({
	animation = 'arrive',
	className,
	onSpinComplete,
	elapsedMs = 0,
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
			style={
				elapsedMs > 0
					? { animationDelay: `${-Math.round(elapsedMs)}ms` }
					: undefined
			}
			alt=""
			aria-hidden="true"
		/>
	)
}

export default LogoStar
