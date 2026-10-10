<div align="center">
    <img src="public/screenshots/kaleidoscope-header.png" alt="Kaleidoscope" width="100%" style="border-radius: 10px; max-width: 1200px; margin-bottom: 15px" />
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
    <a href="http://codewithcarrie.com/kaleidoscope" style="" target="_blank"><img src="public/screenshots/desktop-example.png" alt="Kaleidoscope" height="300px" style="border: 1px solid #ddd; border-radius: 8px; margin-right: 10px;" /></a>
    <a href="http://codewithcarrie.com/kaleidoscope" style="" target="_blank"><img src="public/screenshots/mobile-example.png" alt="Kaleidoscope" height="300px" style="border: 1px solid #ddd; border-radius: 8px;" /></a>
    <a href="http://codewithcarrie.com/kaleidoscope" style="font-size: 1.8rem; color: #2184c7; font-weight: bold" target="_blank"><p>TRY THE LIVE APP</p></a>
    <hr />
</div>

## About

At its core, Kaleidoscope is a digital zen garden. It was built around a simple, satisfying loop: choose a shape and a color palette, paint a few tiles, and watch your design ripple outward into a complex, symmetrical pattern. While it serves as a hands-on sandbox for exploring color theory and geometry, its true purpose is to be a mindful brain break—a quiet, low-stakes corner of the web you can return to whenever you just need to decompress.

Under the hood, this project doubles as a personal developer time capsule. It began years ago as a scrappy vanilla JavaScript experiment born from a single question: Could I actually build a kaleidoscope in the browser? That legacy is preserved [here](./old-dom-app-2020/).

Today, the application reflects how my engineering approach has evolved. It has grown from that early experiment into a fully typed, component-based architecture. I designed and developed the entire stack, tackling everything from responsive UI to complex state management, image export, and testing. AI assistance sped things along, particularly doing some heavy lifting with the underlying symmetry mathematics needed to generate the grid geometries.

## Features

- **Six geometric grids:** Hexagon, triangle, diamond star, hexagram, circle rings, and pinwheel.
- **Symmetrical painting:** Paint a tile in the editable area and its corresponding cells update across the full design.
- **Multiple color palettes:** Pick from curated schemes, then choose a color to paint with.
- **Design controls:** Randomize a design, reset it, or undo and redo recent design changes.
- **Light and dark themes:** Switch the surrounding canvas theme; tiles painted with the theme colors adapt with it.
- **Save and share:** Export a crisp PNG of the complete design, download it, or share it where the browser supports file sharing.
- **Mouse, touch, and keyboard interaction:** Hover reveals the editable wedge on mouse and trackpad; touch users can toggle it. Grid tiles can also be reached with Tab and painted with Enter or Space.
- **Automatic save:** Your current design and preferences are restored from browser storage on your next visit.

<!-- ## Visuals -->

<!-- Screenshots will be added here. -->

## Development Highlights

This project has been a chance to build both a creative user experience and the systems behind it:

- **Reusable SVG grid rendering:** Six different geometric layouts share a common rendering and interaction layer.
- **Geometry-based symmetry:** Cells are grouped by their rotational and reflective relationships, so one paint action updates the matching parts of a design.
- **Typed state and history:** TypeScript models the app state, while reducer-based updates keep design actions predictable and support undo/redo.
- **Thoughtful image export:** The app turns its live SVG into a standalone PNG, carrying over styling and exporting the complete design rather than the on-screen editable-area highlight.
- **Accessible interaction:** Controls have accessible names and states, and grid tiles support keyboard use with screen-reader announcements.
- **Tested behavior:** Vitest and Testing Library cover application state, geometry, controls, persistence, and image-export behavior.

## Working with AI

I used AI as a practical development partner: to explore implementation approaches, help work through technical problems, and speed up parts of the coding process. I led the product and architectural decisions, reviewed and refined the code, and used tests and hands-on checks to validate the behavior.

## About Me

I’m Caroline Jones, a developer who enjoys turning playful ideas into thoughtful, usable software.

[@Carolista on GitHub](https://github.com/Carolista) - [CodeWithCarrie.com](http://codewithcarrie.com) - [LinkedIn](https://www.linkedin.com/in/carolinerjones)
