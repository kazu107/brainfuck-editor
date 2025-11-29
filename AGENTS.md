# Repository Guidelines

## Project Structure & Module Organization
- `index.html`: Single-page Brainfuck IDE with layout, styles, and interpreter logic (memory grid, ASCII table, editor tabs, run/reset controls). Uses CodeMirror 6.65.7 from CDN; UI labels are English.
- `package.json`: Minimal metadata; `npm test` is a placeholder that currently fails.
- `.idea/`: JetBrains project settings; keep changes minimal unless updating IDE config for the team.
- No bundler or build output; all assets are inline or fetched from CDNs.

## Build, Test, and Development Commands
- Run locally by opening `index.html` in a browser or serving statically (avoids `file://` quirks): `python -m http.server 4173` then visit `http://localhost:4173`.
- There is no build step. If you add tooling, document the command here and avoid introducing a mandatory build unless necessary.
- `npm test` currently exits with an error. Replace it with real checks before using it in CI.

## Coding Style & Naming Conventions
- HTML/CSS/JS live together; indent with 4 spaces to match the current file.
- JavaScript: use `const`/`let`, camelCase for variables/functions, and keep new logic inside the existing IIFE to avoid global leakage. Keep code paths simple; the interpreter is synchronous.
- CSS classes are kebab-case. Preserve the dark theme and pinned CodeMirror theme/version when extending styles.
- Keep UI copy in English; add concise comments only where behavior is non-obvious.

## Testing Guidelines
- No automated tests yet. Do quick manual checks for changes:
  - Load the page, confirm CodeMirror renders, and the hex/dec toggle works.
  - Run the sample Hello World, Echo, and Counter programs; verify output and memory updates.
  - Test input handling for `,` with EOF behaviors (unchanged/0/255) and max-steps guard.
- If you add tests, prefer lightweight browser automation (e.g., Playwright) with filenames ending in `.spec.ts/js`.

## Commit & Pull Request Guidelines
- Commits: short, imperative, and scoped (e.g., `Improve memory view scroll handling`). Wrap lines at ~72 chars in the body; reference issues when relevant.
- PRs: include a brief description, screenshots/gifs for UI changes, steps to reproduce/test, and linked issues. Note any CDN/version bumps or new dependencies explicitly.

## Security & Configuration Tips
- External dependencies are loaded from CDNs; pin versions and avoid adding untrusted scripts. Prefer local vendor copies if offline use is required.
- Avoid introducing `eval` or dynamic script injection. Validate any new user input paths the interpreter might consume.
