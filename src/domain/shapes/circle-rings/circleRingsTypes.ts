// One small circle in the circle-rings shape: a single center dot
// (`ring` 0) surrounded by concentric rings of progressively larger,
// more numerous circles. `ring` is the circle's distance band from the
// center (0 for the lone center dot, 1..ringCount outward); `index`
// locates it among that ring's own `6 * ring` evenly-spaced circles (0
// for the center dot, which has no meaningful angular position).
export interface CircleRingsCell {
	readonly ring: number
	readonly index: number
	readonly groupId: string
	readonly isClickable: boolean
}
