import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { faXmark } from '@fortawesome/pro-solid-svg-icons'
import { faPalette, faShapes } from '@fortawesome/sharp-duotone-solid-svg-icons'
import { palettes } from '@/domain/palettes'
import { defaultGridSizes } from '@/domain/shapes'
import {
	ZenStateProvider,
	useZenState,
	savePersistedState,
} from '@/features/zen/state'
import * as colorMath from '@/domain/palettes'
import { useDuotoneIconTint } from './useDuotoneIconTint'

describe('useDuotoneIconTint', () => {
	beforeEach(() => {
		localStorage.clear()
		savePersistedState({
			currentPalette: palettes[0],
			currentColor: palettes[0].colors[0],
			darkMode: true,
			showEditableArea: true,
			gridShape: 'hexagon',
			gridSizes: { ...defaultGridSizes },
			savedBoards: {},
			shapeGroupColors: {},
		})
	})

	afterEach(() => vi.restoreAllMocks())

	it('computes one tint per hook invocation and shares it across duotone icons only', () => {
		const expectedColor = colorMath.withLightness(palettes[0].colors[0], 50)
		const compute = vi.spyOn(colorMath, 'withLightness')
		const { result } = renderHook(() => useDuotoneIconTint(), {
			wrapper: ZenStateProvider,
		})
		const tint = result.current(faPalette)
		expect(tint).toEqual({
			'--fa-secondary-color': expectedColor,
			'--fa-secondary-opacity': '1',
		})
		expect(result.current(faShapes)).toBe(tint)
		expect(result.current(faXmark)).toBeUndefined()
		expect(compute).toHaveBeenCalledTimes(1)
	})

	it('updates the tint when the active palette or dark/light mode changes', () => {
		const { result } = renderHook(
			() => ({
				tint: useDuotoneIconTint(),
				...useZenState(),
			}),
			{ wrapper: ZenStateProvider },
		)
		act(() => result.current.selectPalette(palettes[1]))
		expect(result.current.tint(faPalette)?.['--fa-secondary-color']).toBe(
			colorMath.withLightness(palettes[1].colors[0], 50),
		)
		act(() => result.current.toggleDarkMode())
		expect(result.current.tint(faPalette)?.['--fa-secondary-color']).toBe(
			colorMath.withLightness(palettes[1].colors[0], 70),
		)
		expect(result.current.tint(faXmark)).toBeUndefined()
	})
})
