import styles from './Header.module.css'

// Drops the centered opening layout so the title can be measured in place
// for the entrance animation, without callers depending on Header's styles.
export function releaseOpeningTitle(title: HTMLElement) {
	title.classList.remove(styles.openingTitle)
}
