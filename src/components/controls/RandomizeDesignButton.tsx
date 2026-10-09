import { useAppState } from '@state/useAppState'
import { IconButton } from '@shared'

function RandomizeDesignButton() {
	const { randomizeDesign } = useAppState()

	return (
		<IconButton
			icon="magic-wand-sparkles"
			label="Generate a random design"
			onClick={randomizeDesign}
		/>
	)
}

export default RandomizeDesignButton
