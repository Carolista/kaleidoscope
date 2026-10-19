// Message for a caught value: the Error's own text, or the given fallback.
export function errorMessage(cause: unknown, fallback: string): string {
	return cause instanceof Error ? cause.message : fallback
}
