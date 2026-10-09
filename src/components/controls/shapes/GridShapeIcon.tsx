import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { GridShapeId } from '@appTypes/gridShape'
import { generateHexagonCells } from '@utils/hexagonGrid'
import { axialToPixel, boundingBox, hexagonCorners } from '@utils/hexagonLayout'
import type { HexagonLayout } from '@utils/hexagonLayout'
import { pointsToSvgAttr } from '@utils/svgPoints'
import { generateTriangleCells } from '@utils/triangleGrid'
import { triangleCorners, trianglesBoundingBox } from '@utils/triangleLayout'
import type { TriangleLayout } from '@utils/triangleLayout'
import { generateDiamondStarCells } from '@utils/diamondStarGrid'
import {
	diamondStarBoundingBox,
	diamondStarCellCorners,
} from '@utils/diamondStarLayout'
import type { DiamondStarLayout } from '@utils/diamondStarLayout'
import { generateHexagramCells } from '@utils/hexagramGrid'
import {
	hexagramBoundingBox,
	hexagramStarCellCorners,
} from '@utils/hexagramLayout'
import type { HexagramLayout } from '@utils/hexagramLayout'
import { generateCircleRingsCells } from '@utils/circleRingsGrid'
import {
	circleRingsBoundingBox,
	circleRingsCellCenter,
	circleRingsCellRadius,
} from '@utils/circleRingsLayout'
import type { CircleRingsLayout } from '@utils/circleRingsLayout'
import type { Point } from '@appTypes/geometry'
import styles from './GridShapeIcon.module.css'

export interface GridShapeIconProps {
	readonly shape: GridShapeId
}

// A preview piece is either a straight-edged polygon (every shape but
// circleRings) or a circle (circleRings, whose cells aren't straight-
// edged) — matching the real grid rendering's PolygonCell/CircleCell
// split.
type PreviewPiece =
	| { readonly kind: 'polygon'; readonly points: readonly Point[] }
	| {
			readonly kind: 'circle'
			readonly center: Point
			readonly radius: number
	  }

interface Preview {
	readonly pieces: readonly PreviewPiece[]
	readonly viewBox: string
	// Grout stroke width, in the same SVG user units as `pieces`/`viewBox`.
	readonly strokeWidth: number
}

// Each shape's preview is assembled at a fixed `size: 1` (one small
// piece's edge length), but the 5 shapes' overall spans work out to very
// different multiples of that unit — e.g. the hexagon-of-7's bounding
// box is 5 units wide, while the diamond star's is under 2 — so a single
// fixed stroke-width would read as dramatically thinner or thicker grout
// depending on the shape. Scaling the stroke to a fraction of each
// shape's own viewBox width keeps the grout visually consistent across
// all 5 icons.
const RELATIVE_STROKE_WIDTH = 0.03

function toPreview(
	pieces: readonly PreviewPiece[],
	box: { minX: number; minY: number; maxX: number; maxY: number },
): Preview {
	const width = box.maxX - box.minX
	return {
		pieces,
		viewBox: `${box.minX} ${box.minY} ${width} ${box.maxY - box.minY}`,
		strokeWidth: width * RELATIVE_STROKE_WIDTH,
	}
}

// Builds each shape's preview from the smallest, un-subdivided version
// of its real grid-generation code (gridSize/radius 1, or 2 for the
// triangle — the smallest value that still yields a big-triangle shape
// rather than a single cell) — a hexagon of 7 hexagons, a triangle of 4
// triangles, a diamond star of 6 diamonds, a hexagram of 12 triangles, a
// circle-rings center dot plus its first ring of 6 circles. Reusing the
// actual geometry utilities (rather than hand-drawn paths) keeps every
// icon perfectly in sync with the grid it represents.
function buildPreview(shape: GridShapeId): Preview {
	switch (shape) {
		case 'hexagon': {
			const layout: HexagonLayout = { orientation: 'flat', size: 1 }
			const centers = generateHexagonCells(1).map(cell =>
				axialToPixel(cell, layout),
			)
			return toPreview(
				centers.map(center => ({
					kind: 'polygon',
					points: hexagonCorners(center, layout),
				})),
				boundingBox(centers, layout),
			)
		}
		case 'triangle': {
			const layout: TriangleLayout = { size: 1 }
			const pieces = generateTriangleCells(2).map(cell =>
				triangleCorners(cell, layout),
			)
			return toPreview(
				pieces.map(points => ({ kind: 'polygon', points })),
				trianglesBoundingBox(pieces),
			)
		}
		case 'diamondStar': {
			const layout: DiamondStarLayout = { gridSize: 1, size: 1 }
			const pieces = generateDiamondStarCells(1).map(cell =>
				diamondStarCellCorners(cell, layout),
			)
			return toPreview(
				pieces.map(points => ({ kind: 'polygon', points })),
				diamondStarBoundingBox(pieces),
			)
		}
		case 'hexagram': {
			const layout: HexagramLayout = { gridSize: 1, size: 1 }
			const pieces = generateHexagramCells(1).map(cell =>
				hexagramStarCellCorners(cell, layout),
			)
			return toPreview(
				pieces.map(points => ({ kind: 'polygon', points })),
				hexagramBoundingBox(pieces),
			)
		}
		case 'circleRings': {
			const layout: CircleRingsLayout = { ringCount: 1, size: 1 }
			const circles = generateCircleRingsCells(1).map(cell => ({
				center: circleRingsCellCenter(cell, layout),
				radius: circleRingsCellRadius(cell, layout),
			}))
			return toPreview(
				circles.map(circle => ({ kind: 'circle', ...circle })),
				circleRingsBoundingBox(circles),
			)
		}
	}
}

// A small, decorative SVG preview of a grid shape, filled with the
// current (CSS `color`) accent color — used by GridShapePicker in place
// of a text label. Purely presentational: the containing button is
// responsible for the accessible name, so this renders with
// `aria-hidden`.
function GridShapeIcon({ shape }: GridShapeIconProps) {
	const { pieces, viewBox, strokeWidth } = useMemo(
		() => buildPreview(shape),
		[shape],
	)

	return (
		<svg
			className={styles.icon}
			viewBox={viewBox}
			aria-hidden="true"
			focusable="false"
			style={{ '--grout-width': strokeWidth } as CSSProperties}
		>
			{pieces.map((piece, i) =>
				piece.kind === 'circle' ? (
					<circle
						key={i}
						className={styles.piece}
						cx={piece.center.x}
						cy={piece.center.y}
						r={piece.radius}
					/>
				) : (
					<polygon
						key={i}
						className={styles.piece}
						points={pointsToSvgAttr(piece.points)}
					/>
				),
			)}
		</svg>
	)
}

export default GridShapeIcon
