# Keytune
English, fast WebHID configurator for MCHOSE magnetic keyboards (Ace 75 8K verified), replacing the slow Chinese M HUB. Static site, hosted on GitHub Pages, no runtime dependencies.

## Read first
`docs/internal/tasks/todo.md` starts with a "RESUME HERE" block: it says whether the user's keyboard still has test settings that need restoring. Check it before any hardware work.

## Commands
`npm ci` once, then `npm test` (node --test + coverage), `npm run lint`, `npm run typecheck` (tsc --noEmit, checkJs); all three must be green. Serve with `python -m http.server 8000 --bind 127.0.0.1` and open http://localhost:8000/index.html (Chrome/Edge; WebHID needs localhost or HTTPS).

## Structure
- `index.html` + `src/` the app (`src/transport`, `src/codecs`, `src/safety`, `src/models`, `src/ui`, `src/session.js`, `src/write.js`). `test/` unit tests with a mock keyboard.
- `PROTOCOL.md` the protocol notes: every claim marked verified on hardware or not. Update it with every finding.
- `docs/internal/tasks/todo.md` working task list + hardware state. `docs/` SPEC, ARCHITECTURE, PLAN, ADDING_A_MODEL. `docs/internal/CONSTRAINTS.md` the quality bar.
- `analysis/` official MCHOSE JS copied for reading. **Gitignored, never published or committed.**

## Conventions
- Units: 1 raw unit = 0.01 mm. Key table rows are matrix indexes (0..127), not physical order; use the model's KEYMAP.
- Replies can be shorter than requested: always use the reply's own length byte for the checksum.
- A model is `verified: true` only after a hardware test. Unverified models are read-only.
- Notes for people: plain English, no jargon without a gloss.

## Hard rules
- Only the transport module may call `sendReport`. Only allowlisted commands (3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 0xA0, 0xA1) may be sent. Never implement firmware update, boot mode, reset or factory-restore commands, and never open the boot-mode HID interface (usagePage 0xFF00).
- Every write path: fresh live backup first, validate ranges, write, read back, compare. Report MISMATCH loudly.
- Never weaken a constraint to get green (no skipped/deleted tests, no `@ts-ignore`/`eslint-disable` without a written reason).
- Hardware tests change the user's real keyboard: say what will change, back up, restore afterwards, record in PROTOCOL.md. Closing a restore half-done is the main thing to flag.
- The user cannot read Chinese: translate hub screens, drive the hub yourself; only the user can click Chrome's device picker or unplug the keyboard.
- Do not commit, push or `git init` unless asked.

## Skill routing
| When | Use |
|---|---|
| writing or changing codec/transport logic | `agent-skills:test-driven-development` (golden vectors from real bytes) |
| allowlist, backup import, CSP, supply chain | `agent-skills:security-and-hardening` |
| UI work | `agent-skills:frontend-ui-engineering` |
| CI and Pages deploy | `agent-skills:ci-cd-and-automation` |
| design decisions worth recording | `agent-skills:documentation-and-adrs` |
| a bug or unexpected device reply | `agent-skills:debugging-and-error-recovery` |
| before merge / after a slice | `agent-skills:code-review-and-quality` |
| changing docs/internal/CONSTRAINTS.md or a gate fails | `agent-skills:constraint-driven-development` |
| checking the UI in a real browser | `claude-in-chrome` (localhost only; the device picker is the user's click) |
| before releasing | `agent-skills:ship` |

## Definition of done
Acceptance criteria in `docs/SPEC.md` met, `npm test` + lint + typecheck green, `docs/internal/CONSTRAINTS.md` commands pass, `PROTOCOL.md` updated, and for any write feature: a hardware run with read-back and (where the hub shows it) hub confirmation, then restored.

## Docs
`docs/SPEC.md`, `docs/ARCHITECTURE.md`, `docs/internal/PLAN.md`, `docs/internal/CONSTRAINTS.md`, `PROTOCOL.md`, `docs/internal/tasks/todo.md`.
