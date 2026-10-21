import {
	faEye,
	faEyeSlash,
	faWandMagicSparkles,
} from '@fortawesome/pro-solid-svg-icons'
import { useMemo, useState } from 'react'
import {
	generatePuzzle,
	PUZZLE_RECIPES,
	PUZZLE_SHAPE_LABELS,
	puzzleShapes,
	TUNING_ATTEMPT_LIMIT,
	checkGridSize,
	checkPieceMix,
	checkPinwheelSteps,
	parsePieceMix,
	pinwheelGridSize,
	pinwheelSteps,
	shippedTuning,
	wedgeCellCount,
	type PuzzleShapeId,
} from '@/domain/puzzles'
import { gridSizeOptions, type GridSize } from '@/domain/shapes'
import { PuzzlePlaytest } from '@/features/admin/puzzles'
import { AdminIconButton } from '@/features/admin/common'
import { Button, GridShapeIcon, Input } from '@/ui/components'
import styles from './ShapeCard.module.css'

const SAMPLE_PALETTE = {
	name: 'Sample',
	colors: ['#e63946', '#f4a261', '#e9c46a', '#2a9d8f', '#264653'],
} as const

const mixText = (sizes: readonly number[]) => sizes.join(', ')

// A grid size is n for every shape but the pinwheel, whose grid is rows x columns
// of steps. It is kept as text ("2x3") while being edited.
function sizeText(shapeId: PuzzleShapeId, gridSize: number): string {
	if (shapeId !== 'pinwheel') return String(gridSize)
	const { rowSteps, colSteps } = pinwheelSteps(gridSize)
	return `${rowSteps}x${colSteps}`
}

const stepsOf = (text: string) => text.split('x').map(Number)

// NaN when the text is not a usable pinwheel grid.
function sizeValue(shapeId: PuzzleShapeId, text: string): number {
	if (shapeId !== 'pinwheel') return Number(text)
	const [rows, cols] = stepsOf(text)
	return checkPinwheelSteps(rows, cols) ? NaN : pinwheelGridSize(rows, cols)
}

function sizeProblem(shapeId: PuzzleShapeId, text: string): string | null {
	if (shapeId !== 'pinwheel') return checkGridSize(shapeId, Number(text))
	const [rows, cols] = stepsOf(text)
	return checkPinwheelSteps(rows, cols)
}

const sizeLabel = (shapeId: PuzzleShapeId, text: string) =>
	shapeId === 'pinwheel' ? text.replace('x', ' × ') : text

// Compares sizes by value, so "02x3" is not a change from "2x3".
const sizeKey = (text: string) => text.split('x').map(Number).join('x')

// One axis of a pinwheel grid is edited at a time; an empty box is kept as empty text.
function withSteps(text: string, axis: number, value: string): string {
	const parts = text.split('x')
	parts[axis] = value
	return parts.join('x')
}

// One shape's grid sizes (n) and piece mixes. With no puzzles yet they can be
// tried out freely (nothing is saved); once puzzles exist they are read-only.
export default function ShapeCard({
	shapeId,
	puzzleCount,
}: {
	readonly shapeId: PuzzleShapeId
	readonly puzzleCount: number
}) {
	const shipped = shippedTuning(shapeId)
	const locked = puzzleCount > 0
	const shippedSizes = Object.fromEntries(
		gridSizeOptions.map(({ id }) => [
			id,
			sizeText(shapeId, shipped.gridSizes[id]),
		]),
	) as Record<GridSize, string>
	const shippedMixes = Object.fromEntries(
		PUZZLE_RECIPES.map(recipe => [
			recipe.id,
			mixText(shipped.pieceSizes[recipe.size]),
		]),
	)
	const [triedSizes, setTriedSizes] = useState(shippedSizes)
	const [triedMixes, setTriedMixes] = useState(shippedMixes)
	const [recipeId, setRecipeId] = useState<string>(PUZZLE_RECIPES[0].id)
	const [sample, setSample] = useState(1)
	const sizes = locked ? shippedSizes : triedSizes
	const mixes = locked ? shippedMixes : triedMixes
	const changed =
		JSON.stringify([triedSizes, triedMixes]) !==
		JSON.stringify([shippedSizes, shippedMixes])
	// Whether a value differs from what the shape ships with, ignoring spacing.
	const normalized = (text: string) =>
		(parsePieceMix(text) ?? [text]).join(',')
	const sizeChanged = (size: GridSize) =>
		!locked && sizeKey(triedSizes[size]) !== sizeKey(shippedSizes[size])
	const mixChanged = (id: string) =>
		!locked && normalized(triedMixes[id]) !== normalized(shippedMixes[id])
	const recipe =
		PUZZLE_RECIPES.find(value => value.id === recipeId) ?? PUZZLE_RECIPES[0]
	const sizeString = sizes[recipe.size]
	const mixString = mixes[recipe.id]

	const preview = useMemo(() => {
		const mix = parsePieceMix(mixString)
		const gridSize = sizeValue(shapeId, sizeString)
		const problem =
			sizeProblem(shapeId, sizeString) ??
			checkPieceMix(shapeId, gridSize, mix)
		if (problem || !mix) return { error: problem ?? 'Check the pieces.' }
		try {
			return {
				puzzle: generatePuzzle(
					`${shapeId}-sample-${sample}`,
					SAMPLE_PALETTE,
					recipe,
					shapeId,
					{
						gridSize,
						pieceSizes: mix,
						attemptLimit: TUNING_ATTEMPT_LIMIT,
					},
				),
			}
		} catch (cause) {
			return {
				error:
					cause instanceof Error
						? cause.message
						: 'Unable to build a sample puzzle.',
			}
		}
	}, [shapeId, recipe, sizeString, mixString, sample])

	const name = PUZZLE_SHAPE_LABELS[shapeId]
	return (
		<section className={styles.card} aria-labelledby={`shape-${shapeId}`}>
			<header className={styles.header}>
				<div className={styles.icon}>
					<GridShapeIcon shape={shapeId} />
				</div>
				<div>
					<h3 id={`shape-${shapeId}`}>{name}</h3>
					<p className={styles.status}>
						{locked
							? `Locked: ${puzzleCount} ${puzzleCount === 1 ? 'puzzle uses' : 'puzzles use'} these values.`
							: 'No puzzles yet, so you can try values out. Nothing is saved.'}
					</p>
				</div>
			</header>
			<h4>Grid sizes</h4>
			<table className={styles.table} aria-label={`${name} grid sizes`}>
				<thead>
					<tr>
						<th scope="col">Size</th>
						<th scope="col">
							{shapeId === 'pinwheel' ? 'Rows × Columns' : 'n'}
						</th>
						<th scope="col">Wedge</th>
						<th scope="col">Total</th>
					</tr>
				</thead>
				<tbody>
					{gridSizeOptions.map(({ id, label }) => {
						const n = sizeValue(shapeId, sizes[id])
						const error = locked
							? null
							: sizeProblem(shapeId, sizes[id])
						const wedge = wedgeCellCount(shapeId, n)
						return (
							<tr key={id}>
								<th scope="row">
									{label}
									{sizeChanged(id) && (
										<span className={styles.changed}>
											Changed
										</span>
									)}
								</th>
								<td>
									{locked ? (
										sizeLabel(shapeId, sizes[id])
									) : (
										<>
											{shapeId === 'pinwheel' ? (
												sizes[id]
													.split('x')
													.map((steps, axis) => (
														<Input
															key={axis}
															className={
																styles.nInput
															}
															type="number"
															min={1}
															max={9}
															aria-label={`${name} ${axis ? 'columns' : 'rows'} for ${label}`}
															aria-invalid={
																error
																	? true
																	: undefined
															}
															value={steps}
															onChange={event =>
																setTriedSizes({
																	...triedSizes,
																	[id]: withSteps(
																		sizes[
																			id
																		],
																		axis,
																		event
																			.target
																			.value,
																	),
																})
															}
														/>
													))
											) : (
												<Input
													className={styles.nInput}
													type="number"
													min={1}
													aria-label={`${name} n for ${label}`}
													aria-invalid={
														error ? true : undefined
													}
													value={sizes[id]}
													onChange={event =>
														setTriedSizes({
															...triedSizes,
															[id]: event.target
																.value,
														})
													}
												/>
											)}
											{error && (
												<p
													role="alert"
													className={styles.error}
												>
													{error}
												</p>
											)}
											{sizeChanged(id) && (
												<p className={styles.was}>
													Shipped:{' '}
													{sizeLabel(
														shapeId,
														shippedSizes[id],
													)}
												</p>
											)}
										</>
									)}
								</td>
								<td>{wedge ?? '—'}</td>
								<td>
									{wedge === null
										? '—'
										: puzzleShapes[shapeId].cells(n).length}
								</td>
							</tr>
						)
					})}
				</tbody>
			</table>
			<h4>Recipes</h4>
			<table className={styles.table} aria-label={`${name} recipes`}>
				<thead>
					<tr>
						<th scope="col">Preview</th>
						<th scope="col">Difficulty (Size)</th>
						<th scope="col">Pieces</th>
						<th scope="col">Distribution</th>
					</tr>
				</thead>
				<tbody>
					{PUZZLE_RECIPES.map(item => {
						const itemMix = parsePieceMix(mixes[item.id])
						const itemSize = sizeValue(shapeId, sizes[item.size])
						const error = locked
							? null
							: (sizeProblem(shapeId, sizes[item.size]) ??
								checkPieceMix(shapeId, itemSize, itemMix))
						const active = item.id === recipe.id
						return (
							<tr
								key={item.id}
								className={active ? styles.active : undefined}
							>
								<td>
									<AdminIconButton
										icon={active ? faEye : faEyeSlash}
										label={`Preview ${item.label}`}
										aria-pressed={active}
										onClick={() => setRecipeId(item.id)}
									/>
								</td>
								<th scope="row">
									{item.label}
									{(mixChanged(item.id) ||
										sizeChanged(item.size)) && (
										<span className={styles.changed}>
											Changed
										</span>
									)}
								</th>
								<td>{itemMix?.length || '—'}</td>
								<td>
									{locked ? (
										mixes[item.id]
									) : (
										<>
											<Input
												aria-label={`${name} pieces for ${item.label}`}
												aria-invalid={
													error ? true : undefined
												}
												placeholder="e.g. 3, 2, 1"
												value={mixes[item.id]}
												onChange={event =>
													setTriedMixes({
														...triedMixes,
														[item.id]:
															event.target.value,
													})
												}
											/>
											{error && (
												<p
													role="alert"
													className={styles.error}
												>
													{error}
												</p>
											)}
											{mixChanged(item.id) && (
												<p className={styles.was}>
													Shipped:{' '}
													{shippedMixes[item.id]}
												</p>
											)}
											{!mixChanged(item.id) &&
												sizeChanged(item.size) && (
													<p className={styles.was}>
														{shapeId === 'pinwheel'
															? 'The grid'
															: 'n'}{' '}
														is not the shipped{' '}
														{sizeLabel(
															shapeId,
															shippedSizes[
																item.size
															],
														)}
													</p>
												)}
										</>
									)}
								</td>
							</tr>
						)
					})}
				</tbody>
			</table>
			{!locked && (
				<Button
					disabled={!changed}
					onClick={() => {
						setTriedSizes(shippedSizes)
						setTriedMixes(shippedMixes)
					}}
				>
					Reset to the shipped values
				</Button>
			)}
			<div className={styles.preview}>
				<h4>Sample: {recipe.label}</h4>
				{preview.puzzle ? (
					<PuzzlePlaytest
						key={`${shapeId}-${recipe.id}-${sizeString}-${mixString}-${sample}`}
						puzzle={preview.puzzle}
						actions={
							<AdminIconButton
								icon={faWandMagicSparkles}
								label="Randomize sample"
								onClick={() => setSample(sample + 1)}
							/>
						}
					/>
				) : (
					<p role="alert">{preview.error}</p>
				)}
			</div>
		</section>
	)
}
