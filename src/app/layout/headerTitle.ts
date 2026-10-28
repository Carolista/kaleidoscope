import styles from './Header.module.css'

// Drops the centered opening layout so the title can be measured in place
// for the entrance animation, without callers depending on Header's styles.
export function releaseOpeningTitle(title: HTMLElement) {
	title.classList.remove(styles.openingTitle)
}

// Puts the centered opening layout back, for an entrance that has to start over.
export function restoreOpeningTitle(title: HTMLElement) {
	title.classList.add(styles.openingTitle)
}
