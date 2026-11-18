# Constraints (the quality bar)

Dates and numbers here are the contract. Changing one needs a written reason in the commit and the user's agreement.

| Dimension | Constraint | Enforced by |
|---|---|---|
| Tests | `npm test` green; new logic needs a test; golden vectors use real bytes captured from the keyboard (see PROTOCOL.md) | `npm test` in CI |
| Coverage | >= 80% lines overall, >= 95% lines in `src/transport` and `src/codecs`. ASSUMPTION: needs Node >= 22.8 for `--test-coverage-lines`; verify in slice 1 | `node --experimental-test-coverage --test-coverage-lines=80 --test` (coverage is still marked experimental in Node) |
| Allowlist | Every command byte outside {3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 0xA0, 0xA1} is rejected by the transport; the boot interface can never be opened | allowlist test in `test/transport.test.js` |
| Single send point | `sendReport` appears only under `src/transport/` | CI step: `! grep -rn "sendReport" src --include=*.js \| grep -v "^src/transport/"` |
| Write safety | No write without a backup taken in the same session; every write is read back and compared | tests with the mock device (`test/write-flow.test.js`) |
| Unverified models | Models with `verified: false` expose no write function | test that iterates the model registry |
| Types | `tsc --noEmit` with `checkJs` and `strict`: zero errors | `npm run typecheck` in CI |
| Lint | zero warnings; no `eval`, no `innerHTML` anywhere | `npm run lint` + CI grep |
| Security | no runtime dependencies; strict CSP meta tag on the page; imported backup files are schema/range/model checked before use; GitHub Actions pinned by commit SHA; no secrets in repo | `npm audit` (no deps expected), CSP test, `npm test` import-validation tests, CI review |
| Copyright | `analysis/` is gitignored and absent from the Pages artifact; no MCHOSE source files redistributed | `.gitignore` + CI step `test ! -e analysis` in the deploy job |
| Accessibility | WCAG 2.2 AA target for the page: labels on every control, keyboard operable, contrast checked in both themes | manual keyboard pass per release (no browser tests in CI; ASSUMPTION: acceptable) ; axe-core run by hand on all four tabs (0 violations, 2026-11-18, installed with `npm i --no-save`, not a project dependency) |
| Hardware | Release checklist run on the Ace 75 8K: connect, read, backup, one-key write + read-back, hub confirmation, restore | manual checklist in `docs/SPEC.md` (CI cannot touch a keyboard) |
| Process | no skipped/deleted tests, no new suppressions without a written reason | review + `agent-skills:constraint-driven-development` |

## Design rules rewritten for the redesign (2026-11-18)
The user allowed design-related rules to be rewritten when that makes the look, feel or design better. Hardware-safety rules (allowlist, backup first, read-back, never firmware or boot) are unchanged.

| Rule | Before | Now | Why |
|---|---|---|---|
| Keyboard picture | dark glass, larger roundings, no shifted symbols | rounder, tighter case and keycaps that follow the theme (tokens `--kb-*`, dark glass by default), bold legends with shifted symbols (`1 !`), tighter gaps, a light bar under the F row, no coloured stripe inside keys | the user asked to look more like the official app's keyboard (2026-11-18) |
| Screen size | responsive down to phone width, tabs and scrolling panels | **desktop only**, one screen with no page scroll from 1366 x 768 up; below 1100 px wide or 600 px tall a "Desktop only" notice replaces the app | a keyboard is configured from a computer; one screen is how the MCHOSE hub feels |
| Visual system | colours and sizes written wherever needed | every colour and size comes from `src/ui/tokens.css` (4 px spacing scale, 5 type sizes, radii, glass levels); `test/tokens.test.js` fails on raw colours or stray pixel sizes in `style.css` | consistent spacing and type; one place to change the look |
| Icons | none | an in-house inline SVG set (`src/ui/icons.js`, 19 icons) plus the original keycap logo (generic, not tied to a model) (`logo()`, `src/ui/logo.svg`); no icon library, no MCHOSE artwork | hub-like icons without a dependency or brand assets |
| Look | minimal glass; flat tiles | minimal glass: frosted panels, 1 px light edges, one accent; gradients and blur are allowed here (the taste skill's "no glass" rule was set aside on purpose) | the user asked for a glass design |
| Keyboard picture | keys only | the Ace 75 drawn with its case, the logo key (a generic chevron mark, not MCHOSE artwork) and the LED strip, all lit by a live effect preview (`effects.js`, `preview.js`) | show the keyboard's own features and the result before Apply |
| Hints | visible text under every control | the explanation is a tooltip on the control (and stays in the page for assistive tech) | density: every section fits one screen |
| Accessibility | WCAG 2.2 AA target, manual passes | nice to have, kept where cheap (labels, roving focus, live regions); no screen-reader testing | the user's call |
| Coverage gate | applies to the code the tests load | unchanged (80 percent overall); the preview math is unit tested, the DOM wiring is checked in the browser | |
