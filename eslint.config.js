import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'
import architecture from './eslint-rules/architecture.js'

export default defineConfig([
	globalIgnores(['dist', 'coverage']),
	{
		files: ['**/*.{ts,tsx}'],
		extends: [
			js.configs.recommended,
			tseslint.configs.recommended,
			reactHooks.configs.flat.recommended,
			reactRefresh.configs.vite,
			// Must stay last so it can disable any stylistic rules above that
			// would conflict with Prettier's formatting.
			eslintConfigPrettier,
		],
		languageOptions: {
			ecmaVersion: 2020,
			globals: globals.browser,
			parserOptions: { ecmaFeatures: { jsx: true } },
		},
	},
	{
		// Folder structure and dependency direction; see CONTEXT.md Architecture.
		files: ['src/**/*.{ts,tsx}'],
		plugins: { architecture },
		rules: {
			'architecture/layers': 'error',
			'architecture/no-react-in-domain': 'error',
			'architecture/use-barrels': 'error',
			'architecture/colocated-styles': 'error',
		},
	},
])
