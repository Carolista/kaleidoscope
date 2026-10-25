import { useContext, type ComponentPropsWithRef } from 'react'
import { TextCaseContext, titleCaseNodes } from '@/ui/text'

export interface HeadingProps extends ComponentPropsWithRef<'h2'> {
	readonly level: 1 | 2 | 3 | 4 | 5 | 6
}

// A heading that follows the app's text case. CSS text-transform still applies on top.
export default function Heading({ level, children, ...props }: HeadingProps) {
	const Tag = `h${level}` as const
	const textCase = useContext(TextCaseContext)
	return (
		<Tag {...props}>
			{textCase === 'title' ? titleCaseNodes(children) : children}
		</Tag>
	)
}
