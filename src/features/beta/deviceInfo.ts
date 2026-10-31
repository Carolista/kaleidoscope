// What a bug report records about the tester's device, so they do not have to describe it.
export type DeviceInfo = {
	readonly browser: string
	readonly os: string
	readonly viewport: string
	readonly screen: string
	readonly pixelRatio: number
	readonly touch: boolean
	// Running as an installed app (home-screen shortcut) rather than in a browser tab.
	readonly installed: boolean
	readonly language: string
	readonly userAgent: string
}

export type DeviceEnvironment = {
	readonly userAgent: string
	readonly language: string
	readonly maxTouchPoints: number
	readonly innerWidth: number
	readonly innerHeight: number
	readonly screenWidth: number
	readonly screenHeight: number
	readonly devicePixelRatio: number
	readonly installed: boolean
}

export function readDeviceEnvironment(): DeviceEnvironment {
	const standalone = (navigator as { standalone?: boolean }).standalone
	return {
		userAgent: navigator.userAgent,
		language: navigator.language,
		maxTouchPoints: navigator.maxTouchPoints ?? 0,
		innerWidth: window.innerWidth,
		innerHeight: window.innerHeight,
		screenWidth: window.screen.width,
		screenHeight: window.screen.height,
		devicePixelRatio: window.devicePixelRatio,
		installed:
			standalone === true ||
			!!window.matchMedia?.('(display-mode: standalone)').matches,
	}
}

function major(version: string | undefined) {
	return version?.split('.')[0]
}

function browserName(ua: string): string {
	// Order matters: most browsers' user agents also name Chrome and Safari.
	const candidates: [string, RegExp][] = [
		['Edge', /\bEdg(?:e|A|iOS)?\/([\d.]+)/],
		['Opera', /\bOPR\/([\d.]+)/],
		['Firefox', /\b(?:Firefox|FxiOS)\/([\d.]+)/],
		['Chrome', /\b(?:Chrome|CriOS)\/([\d.]+)/],
		['Safari', /\bVersion\/([\d.]+).*\bSafari\//],
	]
	for (const [name, pattern] of candidates) {
		const version = major(pattern.exec(ua)?.[1])
		if (version) return `${name} ${version}`
	}
	return 'Unknown browser'
}

function osName(ua: string, maxTouchPoints: number): string {
	const ios = /\b(?:iPhone|iPad|iPod)\b.*?\bOS (\d+)[_.](\d+)/.exec(ua)
	if (ios) return `${/iPad/.test(ua) ? 'iPadOS' : 'iOS'} ${ios[1]}.${ios[2]}`
	// iPadOS in "desktop" mode reports itself as a Mac, with a touch screen.
	if (/\bMacintosh\b/.test(ua)) return maxTouchPoints > 1 ? 'iPadOS' : 'macOS'
	const android = /\bAndroid (\d+(?:\.\d+)?)/.exec(ua)
	if (android) return `Android ${android[1]}`
	if (/\bWindows\b/.test(ua)) return 'Windows'
	if (/\bCrOS\b/.test(ua)) return 'ChromeOS'
	if (/\bLinux\b/.test(ua)) return 'Linux'
	return 'Unknown system'
}

export function describeEnvironment(env: DeviceEnvironment): DeviceInfo {
	return {
		browser: browserName(env.userAgent),
		os: osName(env.userAgent, env.maxTouchPoints),
		viewport: `${env.innerWidth}x${env.innerHeight}`,
		screen: `${env.screenWidth}x${env.screenHeight}`,
		pixelRatio: env.devicePixelRatio,
		touch: env.maxTouchPoints > 0,
		installed: env.installed,
		language: env.language,
		// The stored record is capped by the database, so a freakish string must not break a report.
		userAgent: env.userAgent.slice(0, 300),
	}
}

export function captureDevice(): DeviceInfo {
	return describeEnvironment(readDeviceEnvironment())
}

// What the tester is shown of it. Everything else is recorded with the report but would only
// be noise here.
export function deviceSummary(
	info: DeviceInfo,
): readonly { readonly label: string; readonly value: string }[] {
	return [
		{ label: 'System', value: info.os },
		{ label: 'Browser', value: info.browser },
		{ label: 'Viewport', value: info.viewport },
		{ label: 'Touchscreen', value: info.touch ? 'Yes' : 'No' },
	]
}
