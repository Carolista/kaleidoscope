/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const fromSrc = (path: string) =>
	fileURLToPath(new URL(`./src/${path}`, import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
	plugins: [react()],
	// The production build is deployed to https://<user>.github.io/kaleidoscope/
	// (a project page, not a user/org root page), so assets need that path
	// prefix. Keep the dev server at the root so `npm run dev` still serves
	// from http://localhost:5173/ as before.
	base: command === 'build' ? '/kaleidoscope/' : '/',
	resolve: {
		// Keep in sync with `paths` in tsconfig.app.json.
		alias: {
			'@controls': fromSrc('components/controls'),
			'@color-schemes': fromSrc('components/controls/color-schemes'),
			'@shapes': fromSrc('components/controls/shapes'),
			'@grid': fromSrc('components/grid'),
			'@shared': fromSrc('components/shared'),
			'@data': fromSrc('data'),
			'@hooks': fromSrc('hooks'),
			'@services': fromSrc('services'),
			'@state': fromSrc('state'),
			'@test': fromSrc('test'),
			'@appTypes': fromSrc('types'),
			'@utils': fromSrc('utils'),
		},
	},
	test: {
		environment: 'jsdom',
		setupFiles: ['./src/test/setup.ts'],
	},
	server: {
		host: true,
	},
}))
