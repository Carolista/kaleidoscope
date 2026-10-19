import { useDuotoneIconTint } from '@/hooks/useDuotoneIconTint'
import IconButton from './IconButton'
import type { IconButtonProps } from './IconButton'

export default function PlayerIconButton(props: IconButtonProps) {
	const tint = useDuotoneIconTint()
	return <IconButton {...props} iconStyle={tint(props.icon)} />
}
