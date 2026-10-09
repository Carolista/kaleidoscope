import { useAppState } from '@state/useAppState'
import { IconButton } from '@shared'

function RandomizeDesignButton() {
	const { randomizeDesign } = useAppState()

	return (
		<IconButton
			icon="shuffle"
			label="Randomize design"
			onClick={randomizeDesign}
		/>
	)
}

export default RandomizeDesignButton
