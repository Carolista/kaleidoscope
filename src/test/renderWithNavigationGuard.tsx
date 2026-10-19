import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { AdminCatalogProvider } from '@/components/admin/AdminCatalog'
import { NavigationGuardDialog, NavigationGuardProvider } from '@/ui/navigation'

export function renderWithNavigationGuard(
	ui: ReactElement,
	options?: Omit<RenderOptions, 'wrapper'>,
) {
	return render(ui, {
		...options,
		wrapper: ({ children }: { children: ReactNode }) => (
			<NavigationGuardProvider>
				<AdminCatalogProvider>{children}</AdminCatalogProvider>
				<NavigationGuardDialog />
			</NavigationGuardProvider>
		),
	})
}
