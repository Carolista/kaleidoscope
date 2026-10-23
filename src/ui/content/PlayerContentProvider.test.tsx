import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { palettes, testContent } from '@/test/playerContent'
import { cacheContent, readCachedContent } from './contentCache'
import { usePlayerContent } from './PlayerContentContext'
import { PlayerContentProvider } from './PlayerContentProvider'

function Names() {
	return (
		<p>
			{usePlayerContent()
				.palettes.map(item => item.name)
				.join(', ')}
		</p>
	)
}

const fresh = { ...testContent, palettes: palettes.slice(0, 2) }

beforeEach(() => localStorage.clear())

describe('PlayerContentProvider', () => {
	it('waits for the content, shares it, and keeps it for offline use', async () => {
		render(
			<PlayerContentProvider load={() => Promise.resolve(fresh)}>
				<Names />
			</PlayerContentProvider>,
		)
		expect(screen.getByRole('status')).toHaveTextContent(
			'Loading Kaleidoscope',
		)
		expect(await screen.findByText('Tahiti, Cabo')).toBeInTheDocument()
		expect(readCachedContent()).toEqual(fresh)
	})

	it('falls back to the last successful load when the network fails', async () => {
		cacheContent({ ...testContent, palettes: palettes.slice(2, 3) })
		render(
			<PlayerContentProvider
				load={() => Promise.reject(new Error('Offline'))}
			>
				<Names />
			</PlayerContentProvider>,
		)
		expect(await screen.findByText('Club Neon')).toBeInTheDocument()
	})

	it('reports a failure with nothing saved and retries on request', async () => {
		const user = userEvent.setup()
		const load = vi
			.fn()
			.mockRejectedValueOnce(new Error('Network down'))
			.mockResolvedValue(fresh)
		render(
			<PlayerContentProvider load={load}>
				<Names />
			</PlayerContentProvider>,
		)
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Network down',
		)
		await user.click(screen.getByRole('button', { name: 'Try again' }))
		expect(await screen.findByText('Tahiti, Cabo')).toBeInTheDocument()
		expect(load).toHaveBeenCalledTimes(2)
	})

	it('says nothing has been released yet instead of starting without palettes', async () => {
		render(
			<PlayerContentProvider
				load={() => Promise.resolve({ ...testContent, palettes: [] })}
			>
				<Names />
			</PlayerContentProvider>,
		)
		expect(
			await screen.findByText(/Nothing has been released yet/),
		).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Check again' }),
		).toBeInTheDocument()
	})
})

describe('content cache', () => {
	it('ignores missing, corrupt, outdated, and malformed saves', () => {
		expect(readCachedContent()).toBeNull()
		for (const raw of [
			'not json',
			'null',
			JSON.stringify({ version: 2, content: fresh }),
			JSON.stringify({ version: 1 }),
			JSON.stringify({ version: 1, content: { palettes: [] } }),
		]) {
			localStorage.setItem('kaleidoscope:content', raw)
			expect(readCachedContent()).toBeNull()
		}
	})

	it('survives storage that refuses writes', () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('Full')
		})
		expect(() => cacheContent(fresh)).not.toThrow()
		vi.restoreAllMocks()
	})
})
