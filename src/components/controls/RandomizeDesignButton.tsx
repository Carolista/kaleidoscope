import { useAppState } from '../../state/useAppState'
import IconButton from '../shared/IconButton'

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
