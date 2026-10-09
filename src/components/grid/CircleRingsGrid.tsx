import { useMemo, useState } from 'react'
import type { Ref } from 'react'
import {
	CIRCLE_RINGS_GRID_SIZE,
	generateCircleRingsCells,
} from '@utils/circleRingsGrid'
import {
	circleRingsBoundingBox,
	circleRingsCellCenter,
	circleRingsCellRadius,
} from '@utils/circleRingsLayout'
import type { CircleRingsLayout } from '@utils/circleRingsLayout'
import { useAppState } from '@state/useAppState'
import { getThemeColors } from '@state/theme'
import { useIsTouchDevice } from '@utils/useIsTouchDevice'
import CircleCell from './CircleCell'
import styles from './CircleRingsGrid.module.css'

export interface CircleRingsGridProps {
	readonly ringCount?: number
	// Diameter of the center dot/ring 1's circles, in SVG user units
	// (every other ring grows from this floor — see
	// circleRingsLayout.ts's GROWTH_STEP_RATIO). Chosen together with
	// CircleRingsGrid.module.css's max on-screen width so this floor
	// renders at roughly the minimum comfortable touch target (~30px).
	readonly ringSize?: number
	// Exposes the rendered <svg> element, e.g. for image export.
	readonly svgRef?: Ref<SVGSVGElement>
}

const DEFAULT_RING_SIZE = 30

// The circle-rings counterpart of HexagonGrid/TriangleGrid/DiamondStarGrid/
// HexagramGrid: same rendering/interaction approach (hover/touch
// dimming, keyboard support, live region announcements), but built from
// CircleCell (a `<circle>`, not a `<polygon>`) and the concentric-rings-
// of-circles subdivision in circleRingsGrid.ts. Still reuses the shared
// `shapeGroupColors` state/`paintShapeGroup` action, since both are
// already shape-agnostic in practice (just a map keyed by group id).
function CircleRingsGrid({
	ringCount = CIRCLE_RINGS_GRID_SIZE,
	ringSize = DEFAULT_RING_SIZE,
	svgRef,
}: CircleRingsGridProps) {
	const { state, paintShapeGroup } = useAppState()
	const { base, accent } = getThemeColors(state.darkMode)
	const [isHovering, setIsHovering] = useState(false)
	const isTouch = useIsTouchDevice()
	const showPersistentHighlight = isTouch && state.showEditableArea

	const layout: CircleRingsLayout = useMemo(
		() => ({ ringCount, size: ringSize }),
		[ringCount, ringSize],
	)

	const cells = useMemo(
		() => generateCircleRingsCells(ringCount),
		[ringCount],
	)

	const { circles, viewBox, tileCount } = useMemo(() => {
		const positioned = cells.map(cell => ({
			center: circleRingsCellCenter(cell, layout),
			radius: circleRingsCellRadius(cell, layout),
		}))
		const { minX, minY, maxX, maxY } = circleRingsBoundingBox(positioned)
		let clickableIndex = 0
		const circles = cells.map((cell, i) => ({
			key: `${cell.ring},${cell.index}`,
			groupId: cell.groupId,
			isClickable: cell.isClickable,
			tileNumber: cell.isClickable ? ++clickableIndex : undefined,
			...positioned[i],
		}))
		return {
			circles,
			viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
			tileCount: clickableIndex,
		}
	}, [cells, layout])

	const [announcement, setAnnouncement] = useState('')

	function handlePaint(groupId: string, tileNumber: number | undefined) {
		paintShapeGroup(groupId)
		setAnnouncement(`Painted tile ${tileNumber} of ${tileCount}.`)
	}

	return (
		<>
			<p
				id="circle-rings-grid-instructions"
				className={styles.visuallyHidden}
			>
				Tab to move between circles. Press Enter or Space to paint the
				focused circle with the current color.
			</p>
			<svg
				ref={svgRef}
				className={styles.circleRingsGrid}
				viewBox={viewBox}
				role="group"
				aria-label="Kaleidoscope circle rings grid"
				aria-describedby="circle-rings-grid-instructions"
				onPointerMove={event =>
					setIsHovering(
						(event.target as Element).tagName === 'circle',
					)
				}
				onPointerLeave={() => setIsHovering(false)}
			>
				{circles.map(
					({
						key,
						groupId,
						isClickable,
						tileNumber,
						center,
						radius,
					}) => (
						<CircleCell
							key={key}
							center={center}
							radius={radius}
							fill={state.shapeGroupColors[groupId] ?? accent}
							isClickable={isClickable}
							dimmed={
								(isHovering || showPersistentHighlight) &&
								!isClickable
							}
							base={base}
							accent={accent}
							tileNumber={tileNumber}
							tileCount={tileCount}
							onClick={() => handlePaint(groupId, tileNumber)}
						/>
					),
				)}
			</svg>
			<p
				role="status"
				aria-live="polite"
				className={styles.visuallyHidden}
			>
				{announcement}
			</p>
		</>
	)
}

export default CircleRingsGrid
