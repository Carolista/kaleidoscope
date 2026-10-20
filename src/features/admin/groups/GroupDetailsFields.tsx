import { FormField, Select } from '@/ui/components'
import { isPuzzleShapeId, PUZZLE_SHAPE_LABELS } from '@/domain/puzzles'
import {
	isPuzzleGroupTrack,
	purposeHasShape,
	puzzleGroupTrackLabels,
	trackForPurpose,
	tracksForPurpose,
} from '@/features/admin/services'
import type { GroupDetailsValue } from './groupDetailsValue'

function ChoiceField<Value extends string>({
	id,
	label,
	options,
	value,
	disabled,
	onChange,
}: {
	readonly id: string
	readonly label: string
	readonly options: Readonly<Record<Value, string>>
	readonly value: Value
	readonly disabled: boolean
	readonly onChange: (value: Value) => void
}) {
	return (
		<FormField label={label} id={id}>
			{field => (
				<Select
					{...field}
					value={value}
					disabled={disabled}
					onChange={event => {
						const next = Object.keys(options).find(
							(option): option is Value =>
								option === event.target.value,
						)
						if (next !== undefined) onChange(next)
					}}
				>
					{Object.entries<string>(options).map(([option, text]) => (
						<option key={option} value={option}>
							{text}
						</option>
					))}
				</Select>
			)}
		</FormField>
	)
}

// Purpose for every group; puzzle groups add a shape (not for daily) and a track.
export default function GroupDetailsFields<Purpose extends string>({
	idPrefix,
	purposes,
	value,
	puzzleDetails,
	disabled,
	onChange,
}: {
	readonly idPrefix: string
	readonly purposes: Readonly<Record<Purpose, string>>
	readonly value: GroupDetailsValue<Purpose>
	readonly puzzleDetails: boolean
	readonly disabled: boolean
	readonly onChange: (value: GroupDetailsValue<Purpose>) => void
}) {
	const tracks = puzzleDetails ? tracksForPurpose(value.purpose) : []
	const trackOptions: Record<string, string> = Object.fromEntries(
		tracks.map(track => [track, puzzleGroupTrackLabels[track]]),
	)
	return (
		<>
			<ChoiceField
				id={`${idPrefix}-purpose`}
				label="Purpose"
				options={purposes}
				value={value.purpose}
				disabled={disabled}
				onChange={purpose =>
					onChange({
						...value,
						purpose,
						track: puzzleDetails
							? trackForPurpose(purpose, value.track)
							: null,
					})
				}
			/>
			{puzzleDetails && purposeHasShape(value.purpose) && (
				<ChoiceField
					id={`${idPrefix}-shape`}
					label="Shape"
					options={PUZZLE_SHAPE_LABELS}
					value={value.shape}
					disabled={disabled}
					onChange={shape => {
						if (isPuzzleShapeId(shape))
							onChange({ ...value, shape })
					}}
				/>
			)}
			{tracks.length > 0 && value.track && (
				<ChoiceField<string>
					id={`${idPrefix}-track`}
					label="Track"
					options={trackOptions}
					value={value.track}
					disabled={disabled}
					onChange={track => {
						if (isPuzzleGroupTrack(track))
							onChange({ ...value, track })
					}}
				/>
			)}
		</>
	)
}
