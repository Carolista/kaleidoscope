import { useLayoutEffect } from 'react'

// `--base`/`--accent` are set inline on the page, but CSS custom properties only cascade to
// descendants, not up to <body>/<html>, so the background is set on them directly — covering
// the viewport outside the centered page column and the mobile overscroll area. A literal
// color (not `var(--base)`) matches index.html's bootstrap script, which sets this same
// property the same way before React even mounts. useLayoutEffect (not useEffect) runs
// synchronously before the browser paints, so html/body update in the same frame as the page
// instead of one frame later, which previously caused a visible flash when toggling dark mode.
export default function usePageBackground(base: string) {
	useLayoutEffect(() => {
		document.documentElement.style.backgroundColor = base
		document.body.style.backgroundColor = base
	}, [base])
}
