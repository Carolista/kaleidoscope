import { faMagicWandSparkles } from '@fortawesome/sharp-duotone-solid-svg-icons'
import { useAppState } from '@/state/useAppState'
import { PlayerIconButton as IconButton } from '@/components/shared'

function RandomizeDesignButton() {
	const { randomizeDesign } = useAppState()

	return (
		<IconButton
			icon={faMagicWandSparkles}
			label="Generate a random design"
			onClick={randomizeDesign}
		/>
	)
}

export default RandomizeDesignButton
