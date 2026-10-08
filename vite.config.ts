/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
	plugins: [react()],
	// The production build is deployed to https://<user>.github.io/kaleidoscope/
	// (a project page, not a user/org root page), so assets need that path
	// prefix. Keep the dev server at the root so `npm run dev` still serves
	// from http://localhost:5173/ as before.
	base: command === 'build' ? '/kaleidoscope/' : '/',
	test: {
		environment: 'jsdom',
		setupFiles: ['./src/test/setup.ts'],
	},
	server: {
		host: true,
	},
}))
