export interface ExportImageOptions {
	readonly backgroundColor: string
	readonly maxDimension?: number
}

const DEFAULT_MAX_DIMENSION = 1600

export function buildExportFilename(date: Date = new Date()): string {
	const pad = (n: number) => String(n).padStart(2, '0')
	const stamp =
		`${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
		`-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
	return `kaleidoscope-${stamp}.png`
}

// Renders the live hex grid SVG to a PNG blob at a larger, fixed
// resolution (independent of its current on-screen display size) for a
// crisp download/share image.
export async function exportSvgAsPngBlob(
	svg: SVGSVGElement,
	{
		backgroundColor,
		maxDimension = DEFAULT_MAX_DIMENSION,
	}: ExportImageOptions,
): Promise<Blob> {
	const { width: viewBoxWidth, height: viewBoxHeight } = svg.viewBox.baseVal
	const scale = maxDimension / Math.max(viewBoxWidth, viewBoxHeight)
	const width = Math.round(viewBoxWidth * scale)
	const height = Math.round(viewBoxHeight * scale)

	const clone = buildExportClone(svg, width, height)

	const svgUrl = URL.createObjectURL(
		new Blob([new XMLSerializer().serializeToString(clone)], {
			type: 'image/svg+xml;charset=utf-8',
		}),
	)

	try {
		const image = await loadImage(svgUrl)
		const canvas = document.createElement('canvas')
		canvas.width = width
		canvas.height = height
		const ctx = canvas.getContext('2d')
		if (!ctx) throw new Error('Canvas 2D context is unavailable')
		ctx.fillStyle = backgroundColor
		ctx.fillRect(0, 0, width, height)
		ctx.drawImage(image, 0, 0, width, height)
		return await canvasToPngBlob(canvas)
	} finally {
		URL.revokeObjectURL(svgUrl)
	}
}

// Builds the clone that actually gets rasterized: sized to the target
// export resolution, with styling baked in since none of the page's
// stylesheets travel with a serialized, standalone SVG. Exported for
// direct testing (jsdom can't exercise canvas/Image rasterization).
export function buildExportClone(
	svg: SVGSVGElement,
	width: number,
	height: number,
): SVGSVGElement {
	const clone = svg.cloneNode(true) as SVGSVGElement
	clone.setAttribute('width', String(width))
	clone.setAttribute('height', String(height))
	inlineHexagonStrokes(svg, clone)
	forceFullOpacity(clone)
	return clone
}

// The editable-wedge highlight (hover, or the touch-only persistent
// toggle) dims non-wedge cells via a CSS class for on-screen display only
// — the exported image should always show the full, undimmed design, so
// force every polygon fully opaque regardless of that class.
function forceFullOpacity(clonedSvg: SVGSVGElement) {
	for (const polygon of clonedSvg.querySelectorAll('polygon')) {
		;(polygon as SVGPolygonElement).style.opacity = '1'
	}
}

// The hex "grout" lines are a CSS stroke from Hexagon.module.css, which
// isn't available once the SVG is serialized on its own — so bake the
// live computed stroke style into every cloned polygon as plain
// attributes instead of relying on a stylesheet that won't travel with it.
function inlineHexagonStrokes(
	liveSvg: SVGSVGElement,
	clonedSvg: SVGSVGElement,
) {
	const samplePolygon = liveSvg.querySelector('polygon')
	if (!samplePolygon) return
	const computed = getComputedStyle(samplePolygon)
	const stroke = computed.stroke
	const strokeWidth = parseFloat(computed.strokeWidth)
	const strokeLinejoin = computed.strokeLinejoin

	for (const polygon of clonedSvg.querySelectorAll('polygon')) {
		polygon.setAttribute('stroke', stroke)
		polygon.setAttribute('stroke-width', String(strokeWidth))
		polygon.setAttribute('stroke-linejoin', strokeLinejoin)
	}
}

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image()
		image.onload = () => resolve(image)
		image.onerror = () => reject(new Error('Failed to rasterize SVG'))
		image.src = src
	})
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(blob => {
			if (blob) resolve(blob)
			else reject(new Error('Failed to encode PNG'))
		}, 'image/png')
	})
}
