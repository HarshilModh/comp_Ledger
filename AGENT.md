# Agent Knowledge

This file is updated by the Ralph Loop. Each iteration may append operational knowledge discovered during implementation.

## Build & Test

- Lint: `npm run lint` (ESLint, ~1s)
- Unit tests: `npm test` (Jest, ~3s)
- E2E tests: `npm run test:e2e` (Playwright, ~15s — auto-starts the server)

## Conventions

- UI is a single-page app in `public/index.html` (vanilla JS, no build step)
- API calls use the `HEADERS` constant with `x-api-key`
- Storage reads/writes go through `src/data/store.js` (synchronous file I/O)
- Express app and server entry point are split: `src/app.js` exports the app; `src/server.js` listens

## Learned

<!-- Entries will be appended here by loop iterations -->
