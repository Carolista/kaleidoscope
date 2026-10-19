import { useId, useMemo, useState } from 'react'
import type { CSSProperties, Ref } from 'react'
import type { Point } from '@/domain/geometry'
import { useIsTouchDevice } from '@/ui/hooks'
import { getThemeColors } from '@/domain/palettes'
import { useZenState } from '@/features/zen/state'
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

export interface GridInteraction {
	readonly groupColors: Readonly<Record<string, string>>
	readonly onPaint: (groupId: string) => void
	readonly isPaintable: (groupId: string) => boolean
	readonly highlightEditableArea: boolean
}

interface GridViewProps {
	readonly cells: readonly GridCell[]
	readonly viewBox: string
	readonly label: string
	readonly instructions: string
	readonly sizingAspectRatio: number
	readonly svgRef?: Ref<SVGSVGElement>
	readonly hoverAreaPath?: string
	readonly interaction?: GridInteraction
}

function GridView({
	cells,
	viewBox,
	label,
	instructions,
	sizingAspectRatio,
	svgRef,
	hoverAreaPath,
	interaction,
}: GridViewProps) {
	const { state, paintShapeGroup } = useZenState()
	const { base, accent } = getThemeColors(state.darkMode)
	const isTouch = useIsTouchDevice()
	const [isHovering, setIsHovering] = useState(false)
	const [announcement, setAnnouncement] = useState('')
	const instructionsId = useId()
	const highlightEditableArea =
		interaction?.highlightEditableArea ??
		(isHovering || (isTouch && state.showEditableArea))
	const groupColors = interaction?.groupColors ?? state.shapeGroupColors
	const paint = interaction?.onPaint ?? paintShapeGroup

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
			<p id={instructionsId} className="visually-hidden">
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
								event.target.tagName === 'circle' ||
								event.target.hasAttribute(
									'data-grid-hover-area',
								)),
					)
				}
				onPointerLeave={() => setIsHovering(false)}
			>
				{hoverAreaPath && (
					<path
						d={hoverAreaPath}
						fill="transparent"
						stroke="none"
						pointerEvents="all"
						aria-hidden="true"
						data-grid-hover-area=""
					/>
				)}
				{numberedCells.map(cell => {
					const props = {
						fill: groupColors[cell.groupId] ?? accent,
						isClickable:
							cell.isClickable &&
							(interaction?.isPaintable(cell.groupId) ?? true),
						dimmed: highlightEditableArea && !cell.isClickable,
						base,
						accent,
						tileNumber: cell.tileNumber,
						tileCount,
						onClick: () => {
							paint(cell.groupId)
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
			<p role="status" aria-live="polite" className="visually-hidden">
				{announcement}
			</p>
		</>
	)
}

export default GridView
