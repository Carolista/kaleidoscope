import { faMagicWandSparkles } from '@fortawesome/sharp-duotone-solid-svg-icons'
import { useZenState } from '@/features/zen/state'
import { PlayerIconButton as IconButton } from '@/ui/components'

function RandomizeDesignButton() {
	const { randomizeDesign } = useZenState()

	return (
		<IconButton
			icon={faMagicWandSparkles}
			label="Generate a random design"
			onClick={randomizeDesign}
		/>
	)
}

export default RandomizeDesignButton
