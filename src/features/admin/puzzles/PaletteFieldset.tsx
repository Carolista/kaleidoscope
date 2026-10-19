import type { ComponentProps } from 'react'
import styles from './PaletteFieldset.module.css'

// Bordered palette choice group with a scrolling list.
export default function PaletteFieldset(props: ComponentProps<'fieldset'>) {
	return <fieldset {...props} className={styles.palettePicker} />
}
