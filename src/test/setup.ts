import { afterEach, vi } from 'vitest'
import { cleanup, configure } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// findBy*/waitFor give up after 1s by default, which a loaded machine can miss.
configure({ asyncUtilTimeout: 5000 })

// Vitest doesn't expose Jest-style global `afterEach` unless `test.globals`
// is enabled, which is how React Testing Library normally auto-registers
// its post-test unmount. Without this, leftover DOM from one test leaks
// into the next test in the same file. Register it explicitly instead.
afterEach(() => {
	cleanup()
})

// jsdom doesn't implement <dialog>'s imperative show/close behavior, which
// Modal relies on. Polyfill the bits Modal actually calls so component
// tests can exercise real open/close flows without errors.
if (!HTMLDialogElement.prototype.showModal) {
	HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
		this.setAttribute('open', '')
	}
}
if (!HTMLDialogElement.prototype.close) {
	HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
		this.removeAttribute('open')
		this.dispatchEvent(new Event('close'))
	}

	// Layout and page scrolling are not implemented by jsdom.
	vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
	globalThis.ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
}
