import type { CatalogPalette } from '@/features/admin/services'

// Release status label for a palette: Draft, Scheduled, or Live.
export function releaseState(palette: CatalogPalette): string {
	if (!palette.published_at) return 'Draft'
	return palette.release_at && Date.parse(palette.release_at) > Date.now()
		? 'Scheduled'
		: 'Live'
}
