<div align="center">
    <img src="public/screenshots/kaleidoscope-header.png" alt="Kaleidoscope" width="100%" style="border-radius: 10px; max-width: 1200px; margin-bottom: 15px" />
    <hr />
    <div>
        <img src="https://img.shields.io/badge/React-61DBFB?style=for-the-badge&logo=react&logoColor=333333" alt="React" />
        <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
        <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
        <img src="https://img.shields.io/badge/SVG-FFB13B?style=for-the-badge&logo=svg&logoColor=333333" alt="SVG" />
        <img src="https://img.shields.io/badge/CSS_Modules-rebeccapurple?style=for-the-badge&logo=css&logoColor=white" alt="CSS Modules" />
        <img src="https://img.shields.io/badge/Font_Awesome-0A6EB4?style=for-the-badge&logo=fontawesome&logoColor=white" alt="Font Awesome" />
    </div>
    <div style="margin-bottom: 15px">
        <img src="https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest" />
        <img src="https://img.shields.io/badge/Testing_Library-E33332?style=for-the-badge&logo=testinglibrary&logoColor=white" alt="Testing Library" />
        <img src="https://img.shields.io/badge/GitHub_Copilot-222222?style=for-the-badge&logo=githubcopilot&logoColor=white" alt="GitHub Copilot" />
        <img src="https://img.shields.io/badge/ESLint-4B32C3?style=for-the-badge&logo=eslint&logoColor=white" alt="ESLint" />
        <img src="https://img.shields.io/badge/Prettier-F7B93E?style=for-the-badge&logo=prettier&logoColor=333333" alt="Prettier" />
    </div>
    <hr />
    <p style="font-size: 1.4rem; margin-top: 15px;">Unwind and create: an interactive digital kaleidoscope built for quiet brain breaks.</p>
    <hr />
</div>

# TRY KALEIDOSCOPE

Take Kaleidoscope for a spin on the [web app](http://codewithcarrie.com/kaleidoscope). (Mobile app in the works!)

<a href="http://codewithcarrie.com/kaleidoscope" style="" target="_blank"><img src="public/screenshots/desktop-example.png" alt="Kaleidoscope" height="300px" style="border: 1px solid #ddd; border-radius: 8px; margin-right: 10px;" /></a>
<a href="http://codewithcarrie.com/kaleidoscope" style="" target="_blank"><img src="public/screenshots/mobile-example.png" alt="Kaleidoscope" height="300px" style="border: 1px solid #ddd; border-radius: 8px;" /></a>

## About

At its core, Kaleidoscope is a digital zen garden. It was built around a simple, satisfying loop: choose a shape and a color palette, paint a few tiles, and watch your design ripple outward into a complex, symmetrical pattern. While it serves as a hands-on sandbox for exploring color theory and geometry, its true purpose is to be a mindful brain break—a quiet, low-stakes corner of the web you can return to whenever you just need to decompress.

Under the hood, this project doubles as a personal developer time capsule. It began years ago as a scrappy vanilla JavaScript experiment born from a single question: Could I actually build a kaleidoscope in the browser? That legacy is preserved [here](./old-dom-app-2020/).

Today, the application reflects how my engineering approach has evolved. It has grown from that early experiment into a fully typed, component-based architecture. I designed and developed the entire stack, tackling everything from responsive UI to complex state management, image export, and testing. AI assistance sped things along, particularly doing some heavy lifting with the underlying symmetry mathematics needed to generate the grid geometries.

## Features

- **Animated welcome:** The logo spins into view at the center of the page, then settles into the header as the app fades in. Reduced-motion preferences skip the animation.
- **Six geometric grids, three sizes each:** Hexagon, triangle, diamond star, hexagram, circle rings, and pinwheel. Choose small, medium, or large using scaled shape icons.
- **18 independent boards:** Each shape and size keeps its own pattern. Switch freely and pick up where you left off; new boards start blank.
- **Symmetrical painting:** Paint a tile in the editable area and its corresponding cells update across the full design.
- **Multiple color palettes:** Pick from curated schemes, then choose a color to paint with. Palette changes carry the color pattern over across all boards.
- **Design controls:** Randomize or reset the current board, or undo and redo edits and board switches in one session-wide history.
- **Light and dark themes:** Switch the surrounding canvas theme; tiles painted with the theme colors adapt across all boards. Board switches never change your theme.
- **Save and share:** Compare PNG previews with or without grid lines, then download your chosen version or share it where the browser supports file sharing. A pulsing logo star indicates image generation and respects reduced-motion preferences. Your grid-line preference is remembered across designs and visits.
- **Mouse, touch, and keyboard interaction:** Hover reveals the editable wedge on mouse and trackpad; touch users can toggle it. Grid tiles can also be reached with Tab and painted with Enter or Space. Focus outlines remain visible for keyboard navigation without lingering after mouse clicks or taps.
- **Mobile-friendly modals:** Dialogs gently drift into focus and fade away on close, with animations skipped for reduced-motion preferences. Titles and close controls stay visible while content scrolls, with edge indicators for more options and background scrolling locked through closing.
- **Automatic save:** All board patterns, your active board, per-shape size choices, and preferences are restored from browser storage on your next visit. Undo history starts fresh each session.
- **Puzzle Mode prototype:** Switch between Zen Mode and a small hexagon puzzle. Arrange three connected pieces to match a Cabo-palette target, with mirrored placement, mouse/touch dragging, and keyboard-friendly select-and-place controls. Puzzle progress survives mode switches but is intentionally not saved across reloads.

<!-- ## Visuals -->

<!-- Screenshots will be added here. -->

## Development Highlights

This project has been a chance to build both a creative user experience and the systems behind it:

- **Reusable SVG grid rendering:** Six different geometric layouts share a common rendering and interaction layer.
- **Geometry-based symmetry:** Cells are grouped by their rotational and reflective relationships, so one paint action updates the matching parts of a design.
- **Typed state and history:** TypeScript models the app state, while reducer-based updates keep design actions predictable and support undo/redo.
- **Thoughtful image export:** The app turns its live SVG into a standalone PNG, exporting the complete design rather than the on-screen editable-area highlight. Lined and line-free previews are cached while the save dialog is open for instant switching after generation.
- **Accessible interaction:** Controls have accessible names and states, and grid tiles support keyboard use with screen-reader announcements.
- **Tested behavior:** Vitest and Testing Library cover application state, geometry, controls, persistence, and image-export behavior.

## Puzzle Mode prototype

The database foundation and Dashboard setup instructions are documented
in [supabase/README.md](./supabase/README.md). Admin sign-in is available at
`#/admin` after local configuration; the player prototype below remains local
and unchanged.

The admin **Hexagon puzzle lab** supports all six size/rotation recipes, a visual
Supabase palette picker, and one-click randomization. Previously previewed seeds
are skipped per recipe during the lab session; seeds are not displayed.
Saved puzzles supply persistent exclusions across palettes and intended uses.
Palette changes recolor the same design without resetting placements.
At wider widths, palette controls sit beside recipe/randomize controls; on narrow
screens they stack. Sign-out sits above the workspace beside the signed-in account.

Click/tap tray pieces to rotate in rotation-enabled recipes; drag to move.
Double-click/double-tap board pieces or drag back to return them to the tray.
Keyboard users can rotate/select with Enter/Space, activate a board tile to place,
and use Delete/Backspace on an occupied tile to return its piece. Square tray
slots stay fixed through rotation and use one subtle selected border.
The admin workspace opens with a draft gallery. **New puzzle** and each card's
**Edit** button open dedicated creation/editing views. Save named Set/pack or Daily
drafts atomically; reopening uses the stored definition rather than regeneration.
After saving, palette/recipe choices apply to the next generation without changing
the saved puzzle. Wide metadata rows use name/use/save columns; narrow screens stack.
Unsaved work is guarded when leaving the workspace.

Non-clickable cards have custom selection checkboxes and small blue Edit/red Delete
icons. Select all shown or individual drafts to change palettes or delete in bulk.
Palette changes require Apply; deletion confirms count and names. Bulk operations
are all-or-nothing, with database release/reference checks. Assigned drafts cannot
be deleted or switch intended use.

Playtest placements remain memory-only. Publishing, assignments, player progress,
and changes to Zen saves are not included. See
[Supabase instructions](./supabase/README.md) for required migrations and tests.

The header switch opens a session-only proof of concept; it does not change or
overwrite saved Zen designs. Pieces may be placed anywhere they fit within the
six-tile symmetry wedge without overlapping. A puzzle is solved when all six
tiles match the target colors, not merely when every piece has been placed.
Use the rotate icon to restart the current puzzle. On completion, a small
**Congrats!** dialog offers **Next Puzzle**. Closing it leaves the solved design
visible, with a **Next puzzle** button below the board. Rotation, accounts, rewards, sets/packs, and puzzle
persistence are not included yet.

Placed pieces are outlined on the board and disabled/desaturated in the tray;
move them directly from the board or return them by dragging back or
double-clicking/double-tapping. Mirrored tiles
stay muted until completion, when the full design is revealed and piece
interaction and outlines are removed. Restart makes the board editable again.
The goal image and uniformly scaled pieces share a compact row above the
full-width playable board. Visible instructions and piece labels are omitted;
controls retain accessible names and placement feedback is announced to screen
readers.

[`generateHexPuzzle(seed, scheme)`](./src/puzzles/hexPuzzle.ts) produces a
serializable, deterministic puzzle definition with the target, fixed-orientation
colored piece offsets, and a known solution. The current version uses the small
hexagon and connected pieces of one, two, and three tiles; the UI passes the Cabo
palette. Future set/pack authoring can call this pure generator with explicit
seeds and store the generated definitions. Save the complete versioned
definition, not just a seed, so a future generator change cannot alter a
published puzzle. The admin lab wraps the expanded generator with a version-2
palette-slot authoring model and private solution metadata. Draft persistence
is still pending; neither generator certifies difficulty or uniqueness.

## Working with AI

I used AI as a practical development partner: to explore implementation approaches, help work through technical problems, and speed up parts of the coding process. I led the product and architectural decisions, reviewed and refined the code, and used tests and hands-on checks to validate the behavior.

## About Me

I’m Caroline Jones, a developer who enjoys turning playful ideas into thoughtful, usable software.

[@Carolista on GitHub](https://github.com/Carolista) - [CodeWithCarrie.com](http://codewithcarrie.com) - [LinkedIn](https://www.linkedin.com/in/carolinerjones)
