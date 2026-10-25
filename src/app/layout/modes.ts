import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
	faHouse,
	faPuzzlePieceSimple,
	faSpa,
} from '@fortawesome/pro-solid-svg-icons'

export type Mode = 'home' | 'zen' | 'puzzle'

export const MODES: Readonly<
	Record<Mode, { readonly label: string; readonly icon: IconDefinition }>
> = {
	home: { label: 'Home', icon: faHouse },
	zen: { label: 'Zen', icon: faSpa },
	puzzle: { label: 'Puzzle', icon: faPuzzlePieceSimple },
}
