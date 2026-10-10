import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { useAppState } from '@state/useAppState'
import { withLightness } from '@utils/colorMath'

// Lightness the active palette's color is normalized to for a duotone
// icon's secondary (background/fill) layer, rendered fully opaque rather
// than relying on CSS translucency (which would blend toward whatever's
// actually rendered behind the icon). The primary (line art) layer is
// left as `currentColor` so icons still read clearly against their
// surrounding text color.
//
// Tuned per theme rather than a single fixed value: the same absolute
// lightness reads as vivid against a dark backdrop but heavy/muddy
// against a light one (simultaneous contrast), so light mode needs a
// noticeably lighter target than dark mode to look equally balanced.
const SECONDARY_TINT_LIGHTNESS_PERCENT: Readonly<
	Record<'light' | 'dark', number>
> = { light: 70, dark: 50 }

// A duotone icon's path data is a 2-element array (secondary layer, then
// primary layer); a single-tone icon (e.g. a classic solid icon) is just
// one path string. Icons from a non-duotone set (like `faXmark` pulled
// from `@fortawesome/pro-solid-svg-icons` for the close button) must skip
// the tint entirely, since there's no secondary layer for it to color.
function isDuotoneIcon(icon: IconDefinition) {
	return Array.isArray(icon.icon[4])
}

// Returns a function that computes the inline style to spread onto a
// `<FontAwesomeIcon>`'s `style` prop, so a duotone icon's secondary layer
// picks up the active color palette, matching every other duotone icon in
// the app. The function returns `undefined` for single-tone icons, which
// have no secondary layer to tint. Returning a function (rather than the
// style itself) lets a single hook call serve multiple icons, e.g. when
// mapping over an array of icons.
export function useDuotoneIconTint() {
	const { state } = useAppState()

	return function duotoneIconTint(icon: IconDefinition) {
		if (!isDuotoneIcon(icon)) {
			return undefined
		}

		// The richest/darkest color in the active palette is always first.
		const secondaryColor = withLightness(
			state.currentScheme.colors[0],
			SECONDARY_TINT_LIGHTNESS_PERCENT[state.darkMode ? 'dark' : 'light'],
		)

		return {
			'--fa-secondary-color': secondaryColor,
			'--fa-secondary-opacity': '1',
		}
	}
}
