import path from 'node:path'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import architecture from './architecture.js'

const src = path.resolve(import.meta.dirname, '..', 'src')
const linter = new Linter({ configType: 'flat' })
const config = [
	{
		files: ['**/*.ts', '**/*.tsx'],
		plugins: { architecture },
		rules: {
			'architecture/layers': 'error',
			'architecture/no-react-in-domain': 'error',
			'architecture/use-barrels': 'error',
			'architecture/colocated-styles': 'error',
		},
	},
]

function rulesHit(file, code) {
	return linter
		.verify(code, config, path.join(src, file))
		.map(message => message.ruleId)
}

describe('architecture/layers', () => {
	it.each([
		['features/puzzle/X.ts', "import { ZenMode } from '@/features/zen'"],
		[
			'ui/components/X.ts',
			"import { PuzzleMode } from '@/features/puzzle'",
		],
		['domain/puzzles/X.ts', "import { Button } from '@/ui/components'"],
		['lib/supabase/X.ts', "import { palettes } from '@/domain/palettes'"],
		['features/zen/X.ts', "import { AppEntry } from '@/app'"],
	])('rejects %s importing upward or sideways', (file, code) => {
		expect(rulesHit(file, code)).toContain('architecture/layers')
	})

	it.each([
		['app/X.ts', "import { ZenMode } from '@/features/zen'"],
		['features/zen/X.ts', "import { Button } from '@/ui/components'"],
		['ui/components/X.ts', "import { palettes } from '@/domain/palettes'"],
		[
			'domain/puzzles/X.ts',
			"import { getSupabaseClient } from '@/lib/supabase'",
		],
		[
			'features/zen/X.test.ts',
			"import { PuzzleMode } from '@/features/puzzle'",
		],
	])('allows %s', (file, code) => {
		expect(rulesHit(file, code)).not.toContain('architecture/layers')
	})
})

describe('architecture/no-react-in-domain', () => {
	it('rejects React and stylesheets in domain', () => {
		expect(
			rulesHit('domain/shapes/X.ts', "import { useState } from 'react'"),
		).toContain('architecture/no-react-in-domain')
		expect(
			rulesHit(
				'domain/shapes/X.ts',
				"import styles from './X.module.css'",
			),
		).toContain('architecture/no-react-in-domain')
	})
})

describe('architecture/use-barrels', () => {
	it('rejects a file inside another folder that has a barrel', () => {
		expect(
			rulesHit(
				'features/zen/X.ts',
				"import { withLightness } from '@/domain/palettes/colorMath'",
			),
		).toContain('architecture/use-barrels')
	})

	it('allows barrels, nested shape barrels, and ancestor files inside the folder', () => {
		const code = [
			"import { palettes } from '@/domain/palettes'",
			"import { HEXAGON_GRID_RADII } from '@/domain/shapes/hexagon'",
		].join('\n')
		expect(rulesHit('features/zen/X.ts', code)).toEqual([])
		expect(
			rulesHit(
				'domain/shapes/hexagon/X.ts',
				"import { gridSizeOptions } from '@/domain/shapes/sizes'",
			),
		).toEqual([])
	})
})

describe('architecture/colocated-styles', () => {
	it.each([
		"import styles from '@/features/admin/shell/AdminPortal.module.css'",
		"import styles from './sub/X.module.css'",
		"import { thing } from '../thing'",
	])('rejects %s', code => {
		expect(rulesHit('features/admin/puzzles/X.tsx', code)).toContain(
			'architecture/colocated-styles',
		)
	})

	it('allows a stylesheet from the same folder', () => {
		expect(
			rulesHit(
				'features/admin/puzzles/X.tsx',
				"import styles from './X.module.css'",
			),
		).toEqual([])
	})
})
