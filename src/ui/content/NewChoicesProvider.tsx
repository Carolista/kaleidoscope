import {
	useCallback,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from 'react'
import type { PlayerContent } from './playerContent'
import { NewChoicesContext } from './NewChoicesContext'
import { loadSeenChoices, saveSeenChoices, unseenChoices } from './newChoices'
import type { SeenChoices } from './newChoices'

function currentChoices(content: PlayerContent): SeenChoices {
	return {
		palettes: new Set(content.palettes.map(palette => palette.id)),
		shapes: new Set(content.unlockedShapes),
	}
}

// Remembers which palettes and shapes the player has looked at. A player with no record
// starts with everything they have now counted as seen, so only what they earn or what
// is released afterward shows as new. Mounted for the whole app so that a reward earned
// in Puzzle Mode is still new when the player gets to Zen.
export function NewChoicesProvider({
	userId,
	content,
	children,
}: {
	readonly userId: string | null
	readonly content: PlayerContent
	readonly children: ReactNode
}) {
	const [seen, setSeen] = useState(
		() => loadSeenChoices(userId) ?? currentChoices(content),
	)
	useEffect(() => {
		saveSeenChoices(userId, seen)
	}, [userId, seen])

	const markPalettesSeen = useCallback(() => {
		setSeen(previous => {
			const palettes = currentChoices(content).palettes
			return [...palettes].every(id => previous.palettes.has(id))
				? previous
				: {
						...previous,
						palettes: new Set([...previous.palettes, ...palettes]),
					}
		})
	}, [content])
	const markShapesSeen = useCallback(() => {
		setSeen(previous => {
			const shapes = currentChoices(content).shapes
			return [...shapes].every(id => previous.shapes.has(id))
				? previous
				: {
						...previous,
						shapes: new Set([...previous.shapes, ...shapes]),
					}
		})
	}, [content])

	const unseen = unseenChoices(content.palettes, content.unlockedShapes, seen)
	const newPaletteIds = useMemo(
		() =>
			new Set(
				content.palettes
					.filter(palette => !seen.palettes.has(palette.id))
					.map(palette => palette.id),
			),
		[content.palettes, seen.palettes],
	)
	const choices = useMemo(
		() => ({
			newPalettes: unseen.palettes,
			newShapes: unseen.shapes,
			newPaletteIds,
			markPalettesSeen,
			markShapesSeen,
		}),
		[
			unseen.palettes,
			unseen.shapes,
			newPaletteIds,
			markPalettesSeen,
			markShapesSeen,
		],
	)
	return (
		<NewChoicesContext.Provider value={choices}>
			{children}
		</NewChoicesContext.Provider>
	)
}
