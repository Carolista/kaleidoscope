import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { faXmark } from '@fortawesome/pro-solid-svg-icons'
import { faPalette, faShapes } from '@fortawesome/sharp-duotone-solid-svg-icons'
import { colorSchemes } from '@data/colorSchemes'
import { AppStateProvider } from '@state/AppContext'
import { useAppState } from '@state/useAppState'
import { savePersistedState } from '@services/storageService'
import * as colorMath from '@utils/colorMath'
import { useDuotoneIconTint } from './useDuotoneIconTint'

describe('useDuotoneIconTint', () => {
	beforeEach(() => {
		localStorage.clear()
		savePersistedState({
			currentScheme: colorSchemes[0],
			currentColor: colorSchemes[0].colors[0],
			darkMode: true,
			showEditableArea: true,
			gridShape: 'hexagon',
			shapeGroupColors: {},
		})
	})

	afterEach(() => vi.restoreAllMocks())

	it('computes one tint per hook invocation and shares it across duotone icons only', () => {
		const expectedColor = colorMath.withLightness(
			colorSchemes[0].colors[0],
			50,
		)
		const compute = vi.spyOn(colorMath, 'withLightness')
		const { result } = renderHook(() => useDuotoneIconTint(), {
			wrapper: AppStateProvider,
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

	it('updates the tint when the active scheme or dark/light mode changes', () => {
		const { result } = renderHook(
			() => ({
				tint: useDuotoneIconTint(),
				...useAppState(),
			}),
			{ wrapper: AppStateProvider },
		)
		act(() => result.current.selectScheme(colorSchemes[1]))
		expect(result.current.tint(faPalette)?.['--fa-secondary-color']).toBe(
			colorMath.withLightness(colorSchemes[1].colors[0], 50),
		)
		act(() => result.current.toggleDarkMode())
		expect(result.current.tint(faPalette)?.['--fa-secondary-color']).toBe(
			colorMath.withLightness(colorSchemes[1].colors[0], 70),
		)
		expect(result.current.tint(faXmark)).toBeUndefined()
	})
})
