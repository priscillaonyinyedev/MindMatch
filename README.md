# MindMatch

A responsive memory matching game built with plain HTML, CSS, and JavaScript. No build step or game library is required.

The board stays in one fixed-height frame and adds one column per level, starting at two. Cards fill their grid slots, stay equal in size within each level, and shrink as the grid grows. Easy uses two rows, Medium uses four rows after Level 1, and Hard uses six rows after Level 1. The matching deck includes enough symbols for the full Hard progression.

## Run locally

Open `index.html` in a browser, or serve this folder with any static file server. A local server is recommended so browser storage and audio behave consistently.

## Deploy

Upload the contents of this folder to a static host such as GitHub Pages, Netlify, Cloudflare Pages, or Vercel. Set the publish directory to the project root. There is no build command.

The game uses browser storage for personal bests. Sound is generated with the Web Audio API and begins only after the player presses Play. If the browser blocks audio, use the Play control again after interacting with the page.

## Project files

- `index.html` — page structure and controls
- `styles.css` — responsive layout, cards, and animations
- `script.js` — game rules, level progression, audio, and personal bests
