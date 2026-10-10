import { useId, useMemo, useState } from 'react'
import type { CSSProperties, Ref } from 'react'
import type { Point } from '@appTypes/geometry'
import { useIsTouchDevice } from '@hooks/useIsTouchDevice'
import { getThemeColors } from '@state/theme'
import { useAppState } from '@state/useAppState'
import CircleCell from './CircleCell'
import PolygonCell from './PolygonCell'
import styles from './GridView.module.css'

export type GridCell = {
	readonly key: string
	readonly groupId: string
	readonly isClickable: boolean
} & (
	| { readonly kind: 'polygon'; readonly corners: readonly Point[] }
	| {
			readonly kind: 'circle'
			readonly center: Point
			readonly radius: number
	  }
)

interface GridViewProps {
	readonly cells: readonly GridCell[]
	readonly viewBox: string
	readonly label: string
	readonly instructions: string
	readonly sizingAspectRatio: number
	readonly svgRef?: Ref<SVGSVGElement>
}

function GridView({
	cells,
	viewBox,
	label,
	instructions,
	sizingAspectRatio,
	svgRef,
}: GridViewProps) {
	const { state, paintShapeGroup } = useAppState()
	const { base, accent } = getThemeColors(state.darkMode)
	const isTouch = useIsTouchDevice()
	const [isHovering, setIsHovering] = useState(false)
	const [announcement, setAnnouncement] = useState('')
	const instructionsId = useId()
	const highlightEditableArea =
		isHovering || (isTouch && state.showEditableArea)

	const { numberedCells, tileCount } = useMemo(() => {
		let tileCount = 0
		const numberedCells = cells.map(cell => ({
			...cell,
			tileNumber: cell.isClickable ? ++tileCount : undefined,
		}))
		return { numberedCells, tileCount }
	}, [cells])

	return (
		<>
			<p id={instructionsId} className={styles.visuallyHidden}>
				{instructions}
			</p>
			<svg
				ref={svgRef}
				className={styles.grid}
				style={
					{
						'--grid-aspect-ratio': sizingAspectRatio,
					} as CSSProperties
				}
				viewBox={viewBox}
				role="group"
				aria-label={label}
				aria-describedby={instructionsId}
				onPointerMove={event =>
					setIsHovering(
						event.target instanceof Element &&
							(event.target.tagName === 'polygon' ||
								event.target.tagName === 'circle'),
					)
				}
				onPointerLeave={() => setIsHovering(false)}
			>
				{numberedCells.map(cell => {
					const props = {
						fill: state.shapeGroupColors[cell.groupId] ?? accent,
						isClickable: cell.isClickable,
						dimmed: highlightEditableArea && !cell.isClickable,
						base,
						accent,
						tileNumber: cell.tileNumber,
						tileCount,
						onClick: () => {
							paintShapeGroup(cell.groupId)
							setAnnouncement(
								`Painted tile ${cell.tileNumber} of ${tileCount}.`,
							)
						},
					}
					return cell.kind === 'circle' ? (
						<CircleCell
							key={cell.key}
							center={cell.center}
							radius={cell.radius}
							{...props}
						/>
					) : (
						<PolygonCell
							key={cell.key}
							corners={cell.corners}
							{...props}
						/>
					)
				})}
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

export default GridView
