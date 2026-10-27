import type { PointerEvent, ReactNode, Ref } from 'react'
import {
	useEffect,
	useEffectEvent,
	useImperativeHandle,
	useRef,
	useState,
} from 'react'
import {
	anchorAt,
	coordinateKey,
	getPuzzleColors,
	type Puzzle,
	isPuzzleSolved,
	pieceCells,
	placePuzzlePiece,
	nearestOpenAnchor,
	type PuzzlePiece,
	type PuzzlePlacements,
	puzzleGridSizeClass,
	puzzleShapes,
	rotateCoordinate,
	screenToBoard,
	STAGE_BOARD_PADDING,
	type StagePiece,
	type StageRect,
} from '@/domain/puzzles'
import type { GridSize } from '@/domain/shapes'
import type { AxialCoord } from '@/domain/shapes/hexagon'
import PuzzleBoard, { PieceGraphic } from './PuzzleBoard'
import PeekOverlay from './PeekOverlay'
import { useTargetGridLines } from './targetGridPreference'
import styles from './PuzzlePlay.module.css'
import { tileSizes } from './tileSizes'
import { useStageLayout } from './useStageLayout'

// Smallest tap target for a piece on the stage (pixels), even when its circle is smaller.
const STAGE_MIN_PIECE = 40

function paddedRect(rect: StageRect, padding: number) {
	return {
		left: rect.x - padding,
		top: rect.y - padding,
		width: rect.width + 2 * padding,
		height: rect.height + 2 * padding,
	}
}

// A finger covers a small piece, so touch holds it this far above the
// fingertip (CSS pixels). The piece, not the finger, decides where it snaps and
// lands. Near the top of the screen it flips below the finger instead. Bigger
// boards have smaller pieces, which need less clearance.
const TOUCH_HOLD_OFFSETS: Readonly<Record<GridSize, number>> = {
	sm: 60,
	md: 56,
	lg: 50,
}

function heldPoint(
	event: { readonly clientX: number; readonly clientY: number },
	pointerType: string,
	offset: number,
) {
	if (pointerType !== 'touch') return { x: event.clientX, y: event.clientY }
	const above = event.clientY - offset
	return {
		x: event.clientX,
		y: above < 0 ? event.clientY + offset : above,
	}
}

interface DragState {
	readonly piece: PuzzlePiece
	readonly pointerId: number
	readonly pointerType: string
	readonly offset: AxialCoord
	readonly startX: number
	readonly startY: number
	readonly x: number
	readonly y: number
	readonly scale: number
	readonly anchor: AxialCoord | null
	// The anchor of the nearest open spot within reach, where the piece snaps.
	readonly snapAnchor?: AxialCoord | null
	// Total turns of the held piece; committed to the puzzle only where it lands.
	readonly rotation: number
	// The board's screen transform at the last pointer move, for snapped drawing.
	readonly board?: DOMMatrix | null
	readonly moved: boolean
}

export interface PuzzleProgress {
	readonly placed: number
	// Whether any piece currently sits in a turned orientation.
	readonly rotated: boolean
}

// The pieces' positions and turns, which is all that is needed to rebuild a board.
export interface PuzzleBoardState {
	readonly placements: PuzzlePlacements
	readonly rotations: Readonly<Record<string, number>>
}

export interface PuzzlePlayHandle {
	// Clears placements, rotations, and selection for the current puzzle.
	readonly reset: () => void
}

export default function PuzzlePlay({
	ref,
	puzzle: currentPuzzle,
	hidden = false,
	solvedMessage,
	celebration,
	contentRef,
	onSolve,
	onProgress,
	initialState,
	onStateChange,
	trayAction,
	aboveBoard,
	layout = 'tray',
	wide = false,
	pageRoom,
	hidePaletteName = false,
	children,
}: {
	readonly ref?: Ref<PuzzlePlayHandle>
	readonly puzzle: Puzzle
	readonly hidden?: boolean
	readonly solvedMessage: string
	// Briefly shown over the board when solved; the status message carries it for assistive tech.
	readonly celebration?: string
	// The target, tray, and board, for callers that animate them as one unit.
	readonly contentRef?: Ref<HTMLDivElement>
	readonly onSolve?: () => void
	// Reports how far along the player is, e.g. for step-by-step guidance.
	readonly onProgress?: (progress: PuzzleProgress) => void
	// Where the pieces start, when picking up an earlier attempt. Read once, on mount.
	readonly initialState?: PuzzleBoardState
	// Reports the pieces' positions and turns whenever they change, until solved.
	readonly onStateChange?: (state: PuzzleBoardState) => void
	// Rendered beside the tray, e.g. an admin Restart.
	readonly trayAction?: ReactNode
	// Rendered between the target/tray and the board, e.g. tutorial guidance.
	readonly aboveBoard?: ReactNode
	// 'stage' packs the target, pieces, and board together so the target can be
	// bigger and the pieces fill the board's empty corners; it falls back to
	// 'tray' (target and tray in a row above the board) until it has room measured.
	readonly layout?: 'tray' | 'stage'
	// On large screens, grows past the page's column (centered on it) so the
	// stage has room for the wide layout. For pages that are narrower than the screen.
	readonly wide?: boolean
	// Height in pixels the page needs around a wide stage (header, headings, controls),
	// which the stage leaves out of the screen's height. For callers with more page than the default.
	readonly pageRoom?: number
	// Leaves out the palette's name below the board, e.g. in tutorials.
	readonly hidePaletteName?: boolean
	// Rendered below the board, e.g. player actions and dialogs.
	readonly children?: ReactNode
}) {
	const [placements, setPlacements] = useState<PuzzlePlacements>(
		initialState?.placements ?? {},
	)
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [rotations, setRotations] = useState<
		Readonly<Record<string, number>>
	>(initialState?.rotations ?? {})
	const [message, setMessage] = useState(
		initialState
			? 'Welcome back. Your pieces are where you left them.'
			: 'Choose a piece to get started.',
	)
	const [drag, setDrag] = useState<DragState | null>(null)
	// Shows the target over the board, to look at it at the board's own size.
	const [peeking, setPeeking] = useState(false)
	// Whether the overlay has fully arrived, so the board is hidden only then.
	const [peekSettled, setPeekSettled] = useState(false)
	const targetRef = useRef<SVGSVGElement>(null)
	const [targetGridLines] = useTargetGridLines()
	const dragRef = useRef<DragState | null>(null)
	const boardRef = useRef<SVGSVGElement>(null)
	const suppressClickRef = useRef(false)
	const {
		element: stageHost,
		layout: stageLayout,
		status: stageStatus,
		height: stageHeight,
	} = useStageLayout(currentPuzzle, layout === 'stage', pageRoom)
	// Until the stage is packed it holds its place; the old layout is only for
	// when nothing fits.
	const onStage = layout === 'stage' && stageStatus !== 'failed'
	const lastTouchTapRef = useRef<{ pieceId: string; time: number } | null>(
		null,
	)
	const displayPieces = currentPuzzle.pieces.map(piece => ({
		...piece,
		tiles: piece.tiles.map(tile =>
			rotateCoordinate(tile, rotations[piece.id] ?? 0),
		),
	}))
	const { rotationStep } = puzzleShapes[currentPuzzle.shape]
	const rotationDegrees = rotationStep * 60
	// A piece lifted off the board leaves its spot empty until it lands again.
	const liftedId = drag?.moved ? drag.piece.id : null
	const shownPlacements =
		liftedId && placements[liftedId]
			? Object.fromEntries(
					Object.entries(placements).filter(
						([id]) => id !== liftedId,
					),
				)
			: placements
	const colors = getPuzzleColors(currentPuzzle, shownPlacements)
	const solved = isPuzzleSolved(currentPuzzle, placements)
	// A held piece snaps to the nearest open spot (see nearestOpenAnchor) so what
	// you see is what lands, and floats with the pointer when there is none.
	const dragSnap =
		drag?.snapAnchor && drag.board
			? { anchor: drag.snapAnchor, board: drag.board }
			: undefined
	const placedCount = Object.keys(placements).length
	const anyRotated = Object.values(rotations).some(turns => turns !== 0)
	const reportProgress = useEffectEvent(() =>
		onProgress?.({ placed: placedCount, rotated: anyRotated }),
	)

	useEffect(() => {
		reportProgress()
	}, [placedCount, anyRotated])

	const reportState = useEffectEvent(() =>
		onStateChange?.({ placements, rotations }),
	)

	useEffect(() => {
		if (!solved) reportState()
	}, [placements, rotations, solved])

	function selectPiece(id: string) {
		if (solved) return
		if (suppressClickRef.current) {
			suppressClickRef.current = false
			return
		}
		setSelectedId(id)
		setMessage(
			'Select a wedge tile to place this piece, or drag it into position.',
		)
	}

	// Keyboard and click placement put the piece's first tile on the cell.
	function placeAt(id: string, cell: AxialCoord) {
		const piece = currentPuzzle.pieces.find(piece => piece.id === id)
		if (piece) place(id, anchorAt(piece, cell, rotations[id] ?? 0))
	}

	// A piece that is not on the board keeps the turns it was held at.
	function keepRotation(id: string, turns: number) {
		if (turns === (rotations[id] ?? 0)) return
		setRotations(previous => ({ ...previous, [id]: turns }))
	}

	function place(
		id: string,
		anchor: AxialCoord,
		rotation = rotations[id] ?? 0,
	) {
		if (solved) return
		const result = placePuzzlePiece(currentPuzzle, placements, id, {
			...anchor,
			...(currentPuzzle.rotationAllowed ? { rotation } : {}),
		})
		if (!result.ok) {
			if (!placements[id]) keepRotation(id, rotation)
			setSelectedId(id)
			setMessage(result.reason)
			return
		}
		keepRotation(id, rotation)
		setPlacements(result.placements)
		setSelectedId(null)
		if (isPuzzleSolved(currentPuzzle, result.placements)) onSolve?.()
		setMessage(
			Object.keys(result.placements).length ===
				currentPuzzle.pieces.length &&
				!isPuzzleSolved(currentPuzzle, result.placements)
				? 'All pieces fit, but the colors do not match yet. Try rearranging them.'
				: 'Piece placed. Choose another piece or move one already on the board.',
		)
	}

	function pieceAt(cell: AxialCoord) {
		return displayPieces.find(piece => {
			const anchor = placements[piece.id]
			return (
				anchor &&
				pieceCells(piece, { q: anchor.q, r: anchor.r }).some(
					tile => coordinateKey(tile) === coordinateKey(cell),
				)
			)
		})
	}

	function activateCell(cell: AxialCoord, keyboard: boolean) {
		if (solved) return
		if (suppressClickRef.current) {
			suppressClickRef.current = false
			return
		}
		const occupied = pieceAt(cell)
		// A piece already on the board has nowhere to move on top of another piece, so
		// clicking that piece selects it. A piece from the tray still gets the overlap feedback.
		if (
			selectedId &&
			!(occupied && placements[selectedId]) &&
			occupied?.id !== selectedId &&
			(keyboard || !currentPuzzle.rotationAllowed)
		)
			placeAt(selectedId, cell)
		else {
			if (occupied) selectPiece(occupied.id)
			else setMessage('Choose a piece from the tray first.')
		}
	}

	function startDrag(
		event: PointerEvent<HTMLElement | SVGPolygonElement>,
		piece: PuzzlePiece,
		offset: AxialCoord,
	) {
		if (
			solved ||
			event.button !== 0 ||
			(event.currentTarget instanceof HTMLButtonElement &&
				event.currentTarget.disabled) ||
			(dragRef.current && dragRef.current.pointerId !== event.pointerId)
		)
			return
		suppressClickRef.current = false
		setPeeking(false)
		const transform = boardRef.current?.getScreenCTM?.()
		const next: DragState = {
			piece,
			pointerId: event.pointerId,
			pointerType: event.pointerType,
			offset,
			startX: event.clientX,
			startY: event.clientY,
			x: event.clientX,
			y: event.clientY,
			scale: transform ? Math.hypot(transform.a, transform.b) : 1,
			anchor: null,
			rotation: rotations[piece.id] ?? 0,
			moved: false,
		}
		dragRef.current = next
		setDrag(next)
		event.currentTarget.setPointerCapture(event.pointerId)
	}

	function pointerPosition(event: PointerEvent): DragState | null {
		const current = dragRef.current
		if (!current || event.pointerId !== current.pointerId) return null
		const held = heldPoint(
			event,
			current.pointerType,
			TOUCH_HOLD_OFFSETS[
				puzzleGridSizeClass(currentPuzzle.shape, currentPuzzle.gridSize)
			],
		)
		const element = document.elementFromPoint(held.x, held.y)
		const key = element
			?.closest('[data-puzzle-cell]')
			?.getAttribute('data-puzzle-cell')
		const coord = key ? key.split(',').map(Number) : null
		const board = boardRef.current?.getScreenCTM?.() ?? null
		return {
			...current,
			x: held.x,
			y: held.y,
			moved:
				current.moved ||
				Math.hypot(
					event.clientX - current.startX,
					event.clientY - current.startY,
				) > 5,
			anchor: coord
				? {
						q: coord[0] - current.offset.q,
						r: coord[1] - current.offset.r,
					}
				: null,
			board,
			snapAnchor: snapAnchorFor(current, board, held.x, held.y),
		}
	}

	function snapAnchorFor(
		held: DragState,
		board: DOMMatrix | null,
		x: number,
		y: number,
	): AxialCoord | null {
		return board
			? nearestOpenAnchor({
					puzzle: currentPuzzle,
					placements,
					pieceId: held.piece.id,
					rotation: currentPuzzle.rotationAllowed ? held.rotation : 0,
					offset: held.offset,
					pointer: screenToBoard(board, { x, y }),
					size: tileSizes[currentPuzzle.shape],
				})
			: null
	}

	// Turns the held piece one step about the tile under the pointer, then looks
	// again for an open spot, so it snaps if it fits there turned.
	function rotateHeld() {
		const held = dragRef.current
		if (!held || solved || !currentPuzzle.rotationAllowed) return
		const offset = rotateCoordinate(held.offset, rotationStep)
		const hovered = held.anchor && {
			q: held.anchor.q + held.offset.q,
			r: held.anchor.r + held.offset.r,
		}
		const turned: DragState = {
			...held,
			rotation: (held.rotation + rotationStep) % 6,
			piece: {
				...held.piece,
				tiles: held.piece.tiles.map(tile =>
					rotateCoordinate(tile, rotationStep),
				),
			},
			offset,
			anchor: hovered && {
				q: hovered.q - offset.q,
				r: hovered.r - offset.r,
			},
		}
		const next = {
			...turned,
			snapAnchor: snapAnchorFor(
				turned,
				held.board ?? null,
				held.x,
				held.y,
			),
		}
		dragRef.current = next
		setDrag(next)
		setMessage(`Piece rotated ${rotationDegrees} degrees.`)
	}

	const rotateOnKey = useEffectEvent((event: KeyboardEvent) => {
		if (
			event.key.toLowerCase() !== 'r' ||
			event.repeat ||
			event.ctrlKey ||
			event.metaKey ||
			event.altKey ||
			!currentPuzzle.rotationAllowed
		)
			return
		event.preventDefault()
		rotateHeld()
	})
	const rotateOnRightClick = useEffectEvent((event: MouseEvent) => {
		if (
			dragRef.current?.pointerType !== 'mouse' ||
			!currentPuzzle.rotationAllowed
		)
			return
		event.preventDefault()
		rotateHeld()
	})
	// A second finger tapping anywhere turns the piece the first finger holds.
	const rotateOnSecondTouch = useEffectEvent(
		(event: globalThis.PointerEvent) => {
			const held = dragRef.current
			if (
				!held ||
				event.pointerType !== 'touch' ||
				held.pointerType !== 'touch' ||
				event.pointerId === held.pointerId ||
				!currentPuzzle.rotationAllowed
			)
				return
			suppressClickRef.current = true
			rotateHeld()
		},
	)
	const holding = drag !== null

	useEffect(() => {
		if (!holding) return
		const onKey = (event: KeyboardEvent) => rotateOnKey(event)
		const onContext = (event: MouseEvent) => rotateOnRightClick(event)
		const onTouch = (event: globalThis.PointerEvent) =>
			rotateOnSecondTouch(event)
		window.addEventListener('keydown', onKey)
		window.addEventListener('contextmenu', onContext)
		window.addEventListener('pointerdown', onTouch)
		return () => {
			window.removeEventListener('keydown', onKey)
			window.removeEventListener('contextmenu', onContext)
			window.removeEventListener('pointerdown', onTouch)
		}
	}, [holding])

	// The stage's tray is everywhere around the board's own cells, which are not.
	function droppedOnTray(x: number, y: number) {
		const element = document.elementFromPoint(x, y)
		return (
			Boolean(element?.closest('[data-puzzle-tray]')) &&
			!(
				element?.tagName.toLowerCase() === 'polygon' &&
				element.closest('[data-puzzle-board]')
			)
		)
	}

	function endDrag(event: PointerEvent) {
		const current = pointerPosition(event)
		if (!current) return
		dragRef.current = null
		setDrag(null)
		if (!current.moved) {
			if (
				current.pointerType === 'touch' &&
				placements[current.piece.id]
			) {
				const previous = lastTouchTapRef.current
				if (
					previous?.pieceId === current.piece.id &&
					event.timeStamp - previous.time <= 350
				) {
					lastTouchTapRef.current = null
					suppressClickRef.current = true
					returnToTray(current.piece.id)
				} else {
					lastTouchTapRef.current = {
						pieceId: current.piece.id,
						time: event.timeStamp,
					}
				}
			} else {
				lastTouchTapRef.current = null
			}
			return
		}
		lastTouchTapRef.current = null
		suppressClickRef.current = true
		// Releasing over a tile with no open spot still tries it, for the reason message.
		const target = current.snapAnchor ?? current.anchor
		if (target) {
			place(current.piece.id, target, current.rotation)
		} else if (droppedOnTray(current.x, current.y)) {
			returnToTray(current.piece.id)
			keepRotation(current.piece.id, current.rotation)
		} else {
			if (!placements[current.piece.id])
				keepRotation(current.piece.id, current.rotation)
			setSelectedId(current.piece.id)
			setMessage(
				'Drop onto a wedge tile, or return the piece to the tray.',
			)
		}
	}

	function returnToTray(id: string) {
		if (solved) return
		const next = { ...placements }
		delete next[id]
		setPlacements(next)
		setSelectedId(null)
		lastTouchTapRef.current = null
		setMessage('Piece returned to the tray.')
	}

	function activateTrayPiece(id: string) {
		if (solved || placements[id]) return
		if (suppressClickRef.current) {
			suppressClickRef.current = false
			return
		}
		lastTouchTapRef.current = null
		selectPiece(id)
		if (currentPuzzle.rotationAllowed) {
			setRotations(previous => ({
				...previous,
				[id]: ((previous[id] ?? 0) + rotationStep) % 6,
			}))
			setMessage(
				`Piece rotated ${rotationDegrees} degrees. Drag it onto the board, or use keyboard placement.`,
			)
		}
	}

	function reset() {
		setPlacements({})
		setRotations({})
		setSelectedId(null)
		dragRef.current = null
		setDrag(null)
		suppressClickRef.current = false
		lastTouchTapRef.current = null
		setPeeking(false)
		setMessage('Choose a piece to get started.')
	}

	useImperativeHandle(ref, () => ({ reset }))

	// A solved board shows the finished design itself.
	const peekOn = peeking && !solved
	const closePeek = useEffectEvent((event: KeyboardEvent) => {
		if (event.key === 'Escape') setPeeking(false)
	})
	useEffect(() => {
		if (!peekOn) return
		const onKey = (event: KeyboardEvent) => closePeek(event)
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [peekOn])

	// A button over the target, since the target itself is an image.
	const targetView = (
		<>
			<PuzzleBoard
				svgRef={targetRef}
				shape={currentPuzzle.shape}
				gridSize={currentPuzzle.gridSize}
				colors={currentPuzzle.target}
				gridlines={targetGridLines}
				target
				dimmed={solved}
			/>
			<button
				type="button"
				className={styles.peekButton}
				aria-label="Show target over the board"
				aria-pressed={peekOn}
				disabled={solved}
				onClick={() => setPeeking(!peekOn)}
			/>
		</>
	)

	const boardView = (
		<>
			<PuzzleBoard
				svgRef={boardRef}
				shape={currentPuzzle.shape}
				gridSize={currentPuzzle.gridSize}
				colors={colors}
				solved={solved}
				pieces={currentPuzzle.pieces}
				placements={shownPlacements}
				selectedId={selectedId}
				onActivate={activateCell}
				onReturn={cell => {
					const piece = pieceAt(cell)
					if (piece) returnToTray(piece.id)
				}}
				onGrab={(event, cell) => {
					const piece = pieceAt(cell)
					if (!piece) return
					const anchor = placements[piece.id]
					startDrag(event, piece, {
						q: cell.q - anchor.q,
						r: cell.r - anchor.r,
					})
				}}
			/>
			<PeekOverlay
				open={peekOn}
				fromRef={targetRef}
				onClose={() => setPeeking(false)}
				onSettledChange={setPeekSettled}
				className={styles.peek}
			>
				<PuzzleBoard
					shape={currentPuzzle.shape}
					gridSize={currentPuzzle.gridSize}
					colors={currentPuzzle.target}
					gridlines={targetGridLines}
					target
				/>
			</PeekOverlay>
			{solved && celebration && (
				<div className={styles.celebration} aria-hidden="true">
					{celebration}
				</div>
			)}
		</>
	)

	// In the tray a piece sits in a square slot; on the stage it is centered in
	// its own circle (`slot`) at `unit` pixels per board unit.
	function pieceButton(
		piece: PuzzlePiece,
		index: number,
		slot?: StagePiece,
		unit?: number,
	) {
		const diameter = slot ? Math.max(2 * slot.radius, STAGE_MIN_PIECE) : 0
		return (
			<button
				type="button"
				key={piece.id}
				className={
					slot ? `${styles.piece} ${styles.stagePiece}` : styles.piece
				}
				style={
					slot
						? {
								left: slot.x - diameter / 2,
								top: slot.y - diameter / 2,
								width: diameter,
								height: diameter,
							}
						: undefined
				}
				aria-label={`Select piece ${index + 1}, ${piece.tiles.length} ${piece.tiles.length === 1 ? 'tile' : 'tiles'}, ${placements[piece.id] ? 'on board' : 'in tray'}`}
				aria-pressed={selectedId === piece.id}
				aria-description={
					currentPuzzle.rotationAllowed
						? `Click or tap to rotate ${rotationDegrees} degrees; drag to move. Keyboard: Enter or Space rotates, then activate a board tile to place.`
						: undefined
				}
				disabled={Boolean(placements[piece.id])}
				onClick={() => activateTrayPiece(piece.id)}
				onPointerDown={event => {
					const tileIndex =
						event.target instanceof Element
							? Number(
									event.target
										.closest('[data-piece-tile]')
										?.getAttribute('data-piece-tile') ?? 0,
								)
							: 0
					startDrag(event, piece, piece.tiles[tileIndex])
				}}
			>
				<PieceGraphic
					shape={currentPuzzle.shape}
					piece={piece}
					stage={
						slot && unit
							? { unit, diameter: 2 * slot.radius }
							: undefined
					}
				/>
			</button>
		)
	}

	return (
		<section
			hidden={hidden}
			className={`${styles.puzzle}${trayAction ? ` ${styles.withTrayAction}` : ''}${wide ? ` ${styles.wide}` : ''}`}
			aria-label="Puzzle Mode"
			onPointerDownCapture={() => {
				suppressClickRef.current = false
			}}
			onKeyDownCapture={() => {
				suppressClickRef.current = false
			}}
			onPointerMove={event => {
				const next = pointerPosition(event)
				if (!next) return
				dragRef.current = next
				setDrag(next)
			}}
			onPointerUp={endDrag}
			onPointerCancel={event => {
				if (dragRef.current?.pointerId !== event.pointerId) return
				dragRef.current = null
				setDrag(null)
				lastTouchTapRef.current = null
				suppressClickRef.current = true
				setMessage('Drag cancelled. Your piece has not moved.')
			}}
		>
			<div ref={contentRef} className={styles.content}>
				{layout === 'stage' && (
					<div ref={stageHost} className={styles.stageHost}>
						{onStage && trayAction && (
							<div className={styles.stageActions}>
								{trayAction}
							</div>
						)}
						{onStage && aboveBoard}
						{onStage && (
							<div
								className={styles.stageSlot}
								style={{ minHeight: stageHeight }}
							>
								{stageLayout && (
									<div
										className={styles.stage}
										style={{
											width: stageLayout.width,
											height: stageLayout.height,
										}}
										data-puzzle-tray=""
									>
										<div
											className={styles.stageItem}
											style={paddedRect(
												stageLayout.target,
												STAGE_BOARD_PADDING *
													stageLayout.targetScale,
											)}
										>
											{targetView}
										</div>
										<div
											className={`${styles.board} ${styles.stageItem}`}
											data-peeking={
												peekSettled || undefined
											}
											style={paddedRect(
												stageLayout.board,
												STAGE_BOARD_PADDING *
													stageLayout.boardScale,
											)}
										>
											{boardView}
										</div>
										<div
											className={styles.stagePieces}
											role="group"
											aria-label="Puzzle pieces"
										>
											{displayPieces.map((piece, index) =>
												pieceButton(
													piece,
													index,
													stageLayout.pieces[index],
													stageLayout.pieceScale,
												),
											)}
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				)}
				{!onStage && (
					<>
						<div className={styles.goalAndPieces}>
							<figure className={styles.target}>
								{targetView}
							</figure>
							<div
								className={styles.tray}
								role="group"
								aria-label="Puzzle pieces"
								data-puzzle-tray=""
							>
								{displayPieces.map((piece, index) =>
									pieceButton(piece, index),
								)}
							</div>
							{trayAction}
						</div>
						{aboveBoard}
						<div
							className={styles.board}
							data-peeking={peekSettled || undefined}
						>
							{boardView}
						</div>
					</>
				)}
			</div>

			<div role="status" className="visually-hidden">
				{solved ? solvedMessage : message}
			</div>
			{children}
			{!hidePaletteName && (
				<div className={styles.paletteName}>
					{currentPuzzle.paletteName}
				</div>
			)}
			{drag?.moved && !hidden && (
				<PieceGraphic
					shape={currentPuzzle.shape}
					piece={drag.piece}
					drag={{ ...drag, snap: dragSnap }}
				/>
			)}
		</section>
	)
}
