import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import {
	previewRelease,
	type ReleasePlan,
	type ReleaseRequest,
} from '@/features/admin/services'
import type { Database } from '@/lib/supabase'

// Loads the plan for a request, and again whenever the request changes. A null request
// means there is nothing to check yet.
export default function useReleasePlan(
	client: SupabaseClient<Database>,
	request: ReleaseRequest | null,
) {
	const [result, setResult] = useState<{
		readonly request: ReleaseRequest
		readonly plan?: ReleasePlan
		readonly error?: unknown
	} | null>(null)

	useEffect(() => {
		if (!request) return
		let current = true
		previewRelease(client, request).then(
			plan => {
				if (current) setResult({ request, plan })
			},
			(error: unknown) => {
				if (current) setResult({ request, error })
			},
		)
		return () => {
			current = false
		}
	}, [client, request])

	// A result for an older request is stale, so the dialog shows it as still loading.
	const fresh = result && result.request === request ? result : null
	return {
		plan: fresh?.plan,
		error: fresh?.error,
		loading: !!request && !fresh,
	}
}
