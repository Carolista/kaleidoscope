import { useState } from 'react'
import { findIntroPalette } from '@/domain/palettes'
import { completesSet, usePlayerContent, usePlayerProgress } from '@/ui/content'
import type { NewRewards, PlayerPuzzleSet } from '@/ui/content'
import AccountPromptModal from './AccountPromptModal'
import {
	hasSeenAccountPrompt,
	hasShownSignInNudge,
	markAccountPromptSeen,
	markSignInNudgeShown,
} from './accountPrompt'
import { PuzzleIntro } from './intro'
import { loadSeenIntros, needsIntro, saveSeenIntros } from './introProgress'
import type { IntroTrack } from './introProgress'
import PuzzleGrid from './PuzzleGrid'
import PuzzleSession from './PuzzleSession'
import PuzzleSetList from './PuzzleSetList'
import RandomizerUnlockedModal from './RandomizerUnlockedModal'
import RewardModal from './RewardModal'
import ShapeUnlockedModal from './ShapeUnlockedModal'
import SignInNudgeModal from './SignInNudgeModal'
import { usePuzzleSwipe } from './usePuzzleSwipe'
import styles from './PuzzleMode.module.css'

type Stage = 'rewards' | 'shapes' | 'randomizer' | 'account' | 'signIn'

interface Announcement {
	readonly rewards: NewRewards
	readonly queue: readonly Stage[]
	readonly open: boolean
	// The solve finished a set, so the player goes back to the set list on closing.
	readonly returnToSets: boolean
}

// What a solve has to announce, in the order the player should hear it. A guest is
// prompted for an account once, and only where one can be created.
function announcementsFor(
	earned: NewRewards,
	canCreateAccount: boolean,
	returningGuest: boolean,
) {
	const queue: Stage[] = []
	if (earned.palettes.length || earned.bonusSets.length) queue.push('rewards')
	if (earned.shapes.length) queue.push('shapes')
	if (earned.randomizer) queue.push('randomizer')
	if (earned.accountShape && canCreateAccount && !hasSeenAccountPrompt())
		queue.push('account')
	// A reminder to sign in, once a session, for a guest who probably has an account.
	if (
		returningGuest &&
		canCreateAccount &&
		!queue.includes('account') &&
		!hasShownSignInNudge()
	)
		queue.push('signIn')
	return queue
}

export default function PuzzleMode({
	hidden = false,
	onOpenZen,
	onCreateAccount,
	returningGuest = false,
	openRequest = null,
}: {
	readonly hidden?: boolean
	// Lets a reward announcement send the player to Zen Mode.
	readonly onOpenZen?: (intent?: 'palette') => void
	// Opens sign-in and sign-up for a guest; absent where accounts cannot be created.
	readonly onCreateAccount?: () => void
	// A guest on a device that has had an account, who is reminded to sign in.
	readonly returningGuest?: boolean
	// Takes the player straight to a puzzle, such as the one they left unfinished. Each
	// new `nonce` is a new request, even for the same puzzle.
	readonly openRequest?: {
		readonly setId: string
		readonly puzzleId: string
		readonly nonce: number
	} | null
}) {
	const content = usePlayerContent()
	const { palettes, puzzleSets, lockedPuzzleSets } = content
	const { solved, markSolved } = usePlayerProgress()
	const [seenIntros, setSeenIntros] = useState(loadSeenIntros)
	const [setId, setSetId] = useState<string | null>(null)
	const [puzzleId, setPuzzleId] = useState<string | null>(null)
	const [handledRequest, setHandledRequest] = useState<number | null>(null)
	if (openRequest && openRequest.nonce !== handledRequest) {
		setHandledRequest(openRequest.nonce)
		setSetId(openRequest.setId)
		setPuzzleId(openRequest.puzzleId)
	}
	// Announcements run one after another; the first of `queue` is on screen. Kept after
	// closing until the dialog has finished animating out.
	const [announcement, setAnnouncement] = useState<Announcement | null>(null)
	const set = puzzleSets.find(item => item.id === setId)
	const item = set?.puzzles.find(puzzle => puzzle.id === puzzleId)
	const { stageRef, contentRef } = usePuzzleSwipe(item?.id ?? null)

	// The first Puzzle Mode visit teaches basic puzzles; the first rotation set teaches turning.
	const introTrack: IntroTrack | null =
		palettes.length === 0 || puzzleSets.length === 0
			? null
			: needsIntro('basic', seenIntros, puzzleSets, solved)
				? 'basic'
				: set?.track === 'rotation' &&
					  needsIntro('rotation', seenIntros, puzzleSets, solved)
					? 'rotation'
					: null

	function completeIntro(track: IntroTrack) {
		setSeenIntros(previous => {
			const next = new Set(previous).add(track)
			saveSeenIntros(next)
			return next
		})
	}

	async function solve(id: string) {
		const finishedSet =
			!solved.has(id) &&
			completesSet(content, id, new Set([...solved, id]))
		const earned = await markSolved(id)
		const queue = announcementsFor(
			earned,
			!!onCreateAccount,
			returningGuest,
		)
		if (!queue.length) return
		if (queue.includes('account')) markAccountPromptSeen()
		if (queue.includes('signIn')) markSignInNudgeShown()
		setAnnouncement({
			rewards: earned,
			queue,
			open: true,
			returnToSets: finishedSet,
		})
	}

	// A finished set sends the player back to the set list to pick another, once, so a
	// set opened from a later dialog is not undone. Puzzle Mode stays mounted while Zen
	// is open, so this is also where the player finds it on returning.
	function closeAnnouncement() {
		if (announcement?.returnToSets) {
			setSetId(null)
			setPuzzleId(null)
		}
		setAnnouncement(
			current =>
				current && { ...current, open: false, returnToSets: false },
		)
	}

	function nextAnnouncement() {
		setAnnouncement(current =>
			current && current.queue.length > 1
				? { ...current, queue: current.queue.slice(1), open: true }
				: null,
		)
	}

	function openZen(intent?: 'palette') {
		closeAnnouncement()
		onOpenZen?.(intent)
	}

	function openSet(target: PlayerPuzzleSet) {
		closeAnnouncement()
		setSetId(target.id)
		setPuzzleId(null)
	}

	const stage = announcement?.queue[0]
	const rewardModal = announcement && (
		<>
			{stage === 'rewards' && (
				<RewardModal
					open={announcement.open}
					rewards={announcement.rewards}
					onClose={closeAnnouncement}
					onAfterClose={nextAnnouncement}
					onOpenZen={() => openZen('palette')}
					onOpenSet={openSet}
				/>
			)}
			{stage === 'shapes' && (
				<ShapeUnlockedModal
					open={announcement.open}
					shapes={announcement.rewards.shapes}
					onClose={closeAnnouncement}
					onAfterClose={nextAnnouncement}
					onOpenZen={openZen}
					onOpenSet={openSet}
				/>
			)}
			{stage === 'randomizer' && (
				<RandomizerUnlockedModal
					open={announcement.open}
					onClose={closeAnnouncement}
					onAfterClose={nextAnnouncement}
					onOpenZen={openZen}
				/>
			)}
			{stage === 'signIn' && (
				<SignInNudgeModal
					open={announcement.open}
					onClose={closeAnnouncement}
					onAfterClose={nextAnnouncement}
					onSignIn={() => {
						closeAnnouncement()
						onCreateAccount?.()
					}}
				/>
			)}
			{stage === 'account' && announcement.rewards.accountShape && (
				<AccountPromptModal
					open={announcement.open}
					shape={announcement.rewards.accountShape}
					onClose={closeAnnouncement}
					onAfterClose={nextAnnouncement}
					onCreateAccount={() => {
						closeAnnouncement()
						onCreateAccount?.()
					}}
				/>
			)}
		</>
	)

	if (introTrack)
		return (
			<div hidden={hidden} className={styles.browser}>
				<PuzzleIntro
					key={introTrack}
					track={introTrack}
					palette={findIntroPalette(palettes, introTrack)}
					onContinue={() => completeIntro(introTrack)}
				/>
			</div>
		)
	if (set && item)
		return (
			<>
				<div ref={stageRef} hidden={hidden} className={styles.stage}>
					<PuzzleSession
						key={item.id}
						set={set}
						item={item}
						solved={solved}
						hidden={hidden}
						contentRef={contentRef}
						onSolved={id => void solve(id)}
						onChoose={setPuzzleId}
						onBack={() => setPuzzleId(null)}
					/>
				</div>
				{rewardModal}
			</>
		)
	return (
		<>
			<section
				hidden={hidden}
				className={styles.browser}
				aria-label="Puzzle Mode"
			>
				{set ? (
					<PuzzleGrid
						set={set}
						solved={solved}
						onChoose={setPuzzleId}
						onBack={() => setSetId(null)}
					/>
				) : (
					<PuzzleSetList
						sets={puzzleSets}
						locked={lockedPuzzleSets}
						solved={solved}
						onChoose={setSetId}
					/>
				)}
			</section>
			{rewardModal}
		</>
	)
}
