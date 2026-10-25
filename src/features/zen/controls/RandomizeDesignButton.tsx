import { faMagicWandSparkles } from '@fortawesome/sharp-duotone-solid-svg-icons'
import { useZenState } from '@/features/zen/state'
import { PlayerIconButton as IconButton } from '@/ui/components'
import { usePlayerContent } from '@/ui/content'

// Earned by finishing every core and bonus puzzle set, so it is not offered before then.
function RandomizeDesignButton() {
	const { randomizeDesign } = useZenState()
	const { randomizerUnlocked } = usePlayerContent()
	if (!randomizerUnlocked) return null

	return (
		<IconButton
			icon={faMagicWandSparkles}
			label="Generate a random design"
			onClick={randomizeDesign}
		/>
	)
}

export default RandomizeDesignButton
