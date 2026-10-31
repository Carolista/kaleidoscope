import { describe, expect, it } from 'vitest'
import {
	describeEnvironment,
	deviceSummary,
	type DeviceEnvironment,
} from './deviceInfo'

function env(userAgent: string, overrides: Partial<DeviceEnvironment> = {}) {
	return describeEnvironment({
		userAgent,
		language: 'en-US',
		maxTouchPoints: 0,
		innerWidth: 1280,
		innerHeight: 720,
		screenWidth: 1920,
		screenHeight: 1080,
		devicePixelRatio: 2,
		installed: false,
		...overrides,
	})
}

const agents = {
	chromeMac:
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
	safariMac:
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
	safariIPhone:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
	chromeIPhone:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
	safariIPad:
		'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
	chromeAndroid:
		'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
	firefoxWindows:
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
	edgeWindows:
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
}

describe('describeEnvironment', () => {
	it.each([
		[agents.chromeMac, 'Chrome 126', 'macOS'],
		[agents.safariMac, 'Safari 17', 'macOS'],
		[agents.safariIPhone, 'Safari 17', 'iOS 17.4'],
		[agents.chromeIPhone, 'Chrome 126', 'iOS 17.4'],
		[agents.safariIPad, 'Safari 17', 'iPadOS 17.4'],
		[agents.chromeAndroid, 'Chrome 126', 'Android 14'],
		[agents.firefoxWindows, 'Firefox 127', 'Windows'],
		[agents.edgeWindows, 'Edge 126', 'Windows'],
	])('names the browser and system in %s', (agent, browser, os) => {
		const info = env(agent)
		expect(info.browser).toBe(browser)
		expect(info.os).toBe(os)
	})

	it('recognizes an iPad that presents itself as a Mac', () => {
		expect(env(agents.safariMac, { maxTouchPoints: 5 }).os).toBe('iPadOS')
		expect(env(agents.safariMac, { maxTouchPoints: 0 }).os).toBe('macOS')
	})

	it('copes with an agent it does not know', () => {
		const info = env('SomethingNew/1.0')
		expect(info.browser).toBe('Unknown browser')
		expect(info.os).toBe('Unknown system')
	})

	it('records sizes, touch, and mode, and caps the agent string', () => {
		const info = env('x'.repeat(1000), {
			maxTouchPoints: 5,
			installed: true,
			innerWidth: 390,
			innerHeight: 664,
		})
		expect(info.viewport).toBe('390x664')
		expect(info.screen).toBe('1920x1080')
		expect(info.pixelRatio).toBe(2)
		expect(info.touch).toBe(true)
		expect(info.installed).toBe(true)
		expect(info.userAgent).toHaveLength(300)
	})
})

describe('deviceSummary', () => {
	it('shows only the system, browser, viewport, and touch screen', () => {
		const lines = deviceSummary(
			env(agents.safariIPhone, {
				maxTouchPoints: 5,
				innerWidth: 390,
				innerHeight: 664,
			}),
		)
		expect(lines).toEqual([
			{ label: 'System', value: 'iOS 17.4' },
			{ label: 'Browser', value: 'Safari 17' },
			{ label: 'Viewport', value: '390x664' },
			{ label: 'Touchscreen', value: 'Yes' },
		])
	})
})
