# RESUME HERE (state saved 2026-11-18, Keytune 0.1.0 is PUBLISHED)

## Where things stand
- **Published:** repo https://github.com/Momkay/keytune (public, branch `main`), live at **https://momkay.github.io/keytune/** (Pages from the Actions workflow; first CI run green, deploy ok, page loads, 37 modules, WebHID available). The app is called **Keytune**. Slices 1-9 and Phase 4 tracks A-D are done. 97 tests, lint, typecheck, `npm audit` (0) green. README (users) and `docs/DEVELOPING.md` (developers) written, 3 screenshots in `docs/screenshots/`.
- Commits are authored with the user's git identity (name and GitHub noreply email). Ask before any further `git push`, force push, release tag or repo setting change; a push to `main` redeploys the site.
- **Built this phase:** one-screen dark glass workspace; keyboard picture with a light bar under the F row and shifted legends; generic keycap logo; profile view + "Use Profile N" (cmd 14); per-key custom colours (cmd 10 read, cmd 11 write, effect 0 = "Custom"); backups carry the colour table.
- **Still open:** (1) the user compares 5 live-preview effects with the real keyboard; (2) README screenshots done; (3) done: repo created, pushed, CI green, Pages live; (4) the light bar follows the BACKLIGHT (confirmed from the MCHOSE product page: 'full-length Horizon RGB Light Bar ... synced with the keyboard backlight'); changed locally, NOT yet pushed; (5) editing profiles 2 and 3 is view-only on purpose. Fill all / Clear all / multi-key paint / restore colours from a backup file were hardware-tested 2026-11-18 and restored. (6) 1366x768: cannot be rendered from the browser tool (viewport stays 1920x889); by the --u formula the board is ~813x387 px in an 834x518 area, so it fits.
- **Allowlist now:** 3,4,5,6,7,8,9,10,11,14,0xA0,0xA1. Never firmware/boot/reset; cmd 241 (custom-parameter area) is still unexplored and not allowed.

## Keyboard state (what a new session must know before touching hardware)
- Settings block, lighting, remap layers, colour table: original (the settings block was verified byte-identical to the 16:51 original several times).
- Keyboard is back at the baseline (Profile 1 active, Horizontal wave, factory colour table), verified byte for byte after each hardware test.
- **All 83 keys have a press point of 2.00 mm, Rapid Trigger off, because the USER set that himself/herself. Do not "restore" it to 1.50 mm.** The "Comfortable typing" preset equals this state.
- Allowlist: 3,4,5,6,7,8,9,0xA0,0xA1. Commands 10/11 (per-key colours) were tried and removed: they only fill a temporary buffer. Command 241 (custom-parameter area) is unexplored and not allowed.

## How to work (practical notes)
- Local server: `python -m http.server 8000 --bind 127.0.0.1` in this folder. Chrome caches ES modules: after edits do `fetch(url,{cache:'reload'})` for each `/src/` resource (from `performance.getEntriesByType('resource')`) and reload, or the page shows old code.
- Exact window sizes: `harness.html?w=1366&h=768&k=0.94` (same-origin iframe; delete before release).
- Hub + app can both read the keyboard at once in two Chrome tabs (the active tab is switched by the tool). The hub card needs one or two clicks after navigating; the first click is sometimes refused, retry.
- The hub text is in an iframe and cannot be scraped; read it by screenshot/zoom.
- Never pass long multi-quote heredocs through Bash (they break); write files with the Write/Edit tools, or write a script to the scratchpad and run it.
- Every write feature: backup first (the app does it on the first Apply), validate, write, read back, then restore the user's state and say so.

## Phase 4 checklist and history
See the Phase 4 section at the end of this file and `docs/internal/tasks/plan.md` "Phase 4". Older slice notes are kept below for reference.

## History (older notes, newest first)
## Keyboard is at its original settings (restored 2026-11-18, ~17:21Z)
Restored via the new modular index.html: RT stability 5, sleep 3 min, debounce 0, Win lock off; read-back confirmed; all 83 key rows are 150 / mode 0 / RT 30,30 / deadzone 15,15. Backup taken just before: ace75-backup-<timestamp>.json in Downloads.
Slice 2 done (src/safety/, src/write.js, CSP meta, 26 tests). Hardware smoke 2026-11-18 ~17:24Z: backup, Esc actuation 150->175 via Apply (read-back OK), restored to 150 (read-back OK, all 83 rows original). Import + diff preview verified on the live page (good file, wrong model, malformed, out-of-range; nothing applied). CSP verified live: external fetch, inline script and external image all blocked. innerHTML now only in src/ui/render.js (lint rule + CI grep).
Slice 3 done (read-only remap decode + viewer): cmd 7 and 8 added to the allowlist with the user's approval; decoded and compared with the hub on 3 layers; see PROTOCOL.md "Key remap matrix". No keyboard writes this slice; keyboard at original settings.
Slice 5 done (remap write UI): cmd 9 added to the allowlist with the user's approval. Hardware test Win Fn layer, Q -> R, read-back OK, hub showed R, restored to factory, all 4 layers equal factory. Keyboard is at its original settings. Backup files in Downloads include matrixHex.
Slice 4 prepared (not deployed): .github/workflows/ci.yml (checks + Pages deploy from main, 4 actions pinned by SHA, site built from an explicit file list), README.md, disclaimer on the page. Waiting for: the user to create the GitHub repo, push, and enable Pages (Settings > Pages > Source: GitHub Actions). Not run in CI yet.
Second closing pass 2026-11-18: logo light, ambient light and the "All lights" switch are done and verified (decoded by running the hub and the app in two tabs; hub confirmed the written values; block restored byte for byte). NOTE the corrected mapping: hub LOGO = bytes 44-51, ambient = bytes 24-31. Per-key custom lighting was built, tested on the keyboard (commands 10/11, user approved), found NOT to persist (the keyboard reloads its saved table when the effect is re-selected, the user saw only the factory pattern), and REMOVED again (allowlist back to 3-9, 0xA0, 0xA1). Keyboard verified at the original state: settings block identical to the original, colour table = factory (white WASD + arrows). STILL NOT DONE / impossible: per-key colours (needs the hub's save mechanism, cmd 241 area), separate RT struct (cmd 241), a real second model, screen reader test, forced-colors test, profiles other than 0.
Closing pass 2026-11-18: axe-core 0 violations on Sensitivity/Remap/Lighting/Settings (heading order, label-in-name for keys, dangling aria-describedby fixed); narrow layout seen at 420 and 820 px via a same-origin iframe harness (small-screen CSS added, no horizontal overflow); forced-colors CSS added (UNTESTED); polling 1k/2k verified; media-key and modifier remap verified and reset; Mac+Fn compared in the hub; Copy report button works; cmd 3 golden vector added (checksum 0x28); bug fixed: on the Remap tab the "Saved" message was overwritten by "Reading this layer". Details in PROTOCOL.md "Closing pass". STILL NOT DONE: LOGO/ambient lights, per-key custom lighting, master light switch, separate RT struct (cmd 241), a real second model, screen reader test, forced-colors test, profiles other than 0. Keyboard: press point 2.00 mm is the user's own setting; everything else original.
Slice 9 done 2026-11-18 (UI polish + accessibility pass). Fixed from an audit of the live page: labels were not linked to sliders/switches/colour picker (el.for does nothing, now htmlFor), 101 tab stops -> 16 (roving tabindex on the keyboard picture, arrow keys move between keys by screen position), tab bar with arrow/Home/End keys, option groups use aria-pressed instead of radio roles, keys announce their state ("W, press point 2.00 millimetres, changed" / "sends R"), spoken key names, one page h1, persistent polite/assertive live regions for messages, focus kept when a panel is redrawn, min text size on small keycaps, light-theme warning colour darkened (3.82 -> 5.17 contrast), data-theme="light"/"dark" override. Verified live with real key presses (Tab order, arrows, tab bar, Enter, focus restore) and the light theme on screen; contrast computed for both themes (all >= 4.5:1 after the fix). NOT done: axe-core run (new dependency, not added), screen reader test, phone/narrow-width layout (window resize does not change the viewport here), high-contrast / forced-colors mode.
Slice 8 done 2026-11-18: model registry lookup (findModel, vendor-wide picker filter), unverified Ace 75 16K profile (a guess copied from the 8K, read-only), unsupported keyboards show their ids and a "Copy report" button without any read or write, read-only mode in the UI for unverified models (banner, controls off, Restore off, write gate still refuses), interface discovery moved to src/transport/discovery.js with tests (boot interface 0xFF00 can never be opened), docs/ADDING_A_MODEL.md. The read-only screen was checked on the real keyboard by temporarily marking the 8K unverified (reverted, tests green). NOT checked: a real second model (none available), the Copy report button in a browser (clipboard).
KEYBOARD STATE: the user changed the key press point of all 83 keys to 2.00 mm themselves (told me 2026-11-18 after I noticed; leave it, do not restore to 1.50 unasked). Everything else (settings block incl. lighting, remap layers) matches the original. "Original settings" in older notes below means before that user change.
Slice 7 done 2026-11-18: debounce on-value = 7 (found in hub code, verified on hardware + hub), polling rate write verified (8k -> 4k -> 8k, no USB re-enumeration), separate press/release struct deliberately not implemented (cmd 241 custom-param area, not allowlisted). Keyboard at original settings (whole settings block identical to the 16:51 original apart from the lighting block, which matches the original too).
RGB (backlight) done 2026-11-18: Lighting tab, bytes 8-16 of the settings block, 22 effects. Verified live (Breathing / level 2 / 50% / #2060FF, confirmed in the hub) and restored: the whole block is identical to the original again. Keyboard is at its original settings.
UI rebuild done 2026-11-18: full-screen glass front-end (Sensitivity / Remap / Settings tabs, keyboard picture, one Apply bar that saves a backup first), session.js holds the keyboard logic (tested with the mock). Verified live: stage a preset on W, Apply (backup + write + read-back OK), restored to Factory feel, all keys 1.50 / RT off. liquid-glass-design skill installed but it is an empty Japanese stub, so the look is hand-made. Not checked: phone-width layout (window resize did not change the viewport), keyboard-only walkthrough, light theme on screen. Old UI files (main.js, render.js) deleted with their tests; index.old.html is the pre-split original and can go.
Slice 1 done (src/ modules, 14 tests, lint, typecheck, CI file). The settings write + read-back on hardware passed with the split code; a one-key write smoke was not repeated. index.old.html is the pre-split original: delete once you are happy.
## How to resume
- Local server: `python -m http.server 8000 --bind 127.0.0.1` from this folder (check it is still running).
- Chrome only grants the HID device until the keyboard is unplugged; after a replug the user must click Connect once (native popup, only the user can click it). Only one page can hold the keyboard: close the hub tab before using index.html and vice versa.
- The user cannot read Chinese: translate hub screens for them. Hub: https://www.mchose.com.cn/#/connectDevice, click the Ace 75 card, tabs: 灯光设置 lighting, 触发设置 trigger, 按键配置 key remap, 高级按键 advanced keys, 性能设置 performance, 其他设置 other. Wait several seconds after each navigation before clicking.
- Next steps: (1) verify the four settings in the hub's performance tab (Win lock, RT stability slider 6, sleep 4, debounce optimisation ON), then restore them; (2) key remap (cmd for key matrix, 3 bytes per key, 128 keys, code in analysis/cz); (3) RGB; (4) separate press/release sensitivity struct; (5) polling-rate write (not tested, may re-enumerate USB).

﻿### Phase 1: Analysis (read-only, no keyboard writes)
- [x] T1: Get the official web app URL from the user; fetch the page and its JS bundles into `analysis/` (S)
- [x] T2: Find the WebHID usage: vendorId/productId filters, usagePage, reportId, `sendReport`/`inputreport` handlers (S)
- [x] T3 (key trigger struct decoded; perf-info command + commit step still to find, see PROTOCOL.md): Decode packet layout: command bytes, payload format, checksum, response parsing (M)
- [x] T4 (not needed: the protocol was decoded from the official code and checked on the keyboard): If the code is obfuscated, capture live traffic in Chrome (chrome://device-log or a WebHID logger) while changing one setting at a time (M, conditional)
- [x] T5 (PROTOCOL.md exists and is updated with every finding): Write `PROTOCOL.md`: every feature (actuation, rapid trigger, remap, RGB, macros, layers, polling rate, calibration) marked decoded, guessed or unknown (S)
### Checkpoint A: Analysis
- [ ] `PROTOCOL.md` reviewed by the user; the Phase 2 decisions are made from it.
### Phase 2: Decide
- [x] T6 (done in practice, see slices 1-9): Choose v1 scope from the decoded features, and mark risky ones (macros, calibration) as later (XS)
- [x] T7 (done: static page, vanilla ES modules, tests, CI file): Confirm the stack (static page and localhost) and the safety rules (XS)
### Checkpoint B: Scope approved by the user
### Phase 3: Build (vertical slices)
- [x] T8: Connect button plus a read-only dump of the current config (S)
- [x] T9 (backup + restore-into-table, restore needs Apply): Backup and restore config to a JSON file (S)
- [x] T10 (verified by read-back; replug persistence untested): Write one setting: actuation distance for one key (M)
- [~] T11 (built: all-75-key editor for actuation, RT press/release, deadzones; Apply verified on 2 keys (actuation + deadzone) with restore; RT on/off = keyMode 0/1/2 (all three verified with hub); key names verified for all 79 hub-visible keys; FN1, Mute, RT unchecked): Per-key 75% layout view; actuation and rapid trigger for all keys (M)
- [x] T12 (read slice 3, single-key write slice 5, hardware verified; matrix key table is 3 bytes x 128 via getKeyMatrix, see analysis/cz main bundle): Key remap and layers (M)
- [~] T13 (main backlight done and hardware-verified: effect, brightness, speed, direction, colour; LOGO, ambient and per-key custom lighting not done): RGB and lighting (M)
- [x] T14 (polling rate, debounce, lighting, remap done; macros and advanced keys not done): Remaining features (polling rate, macros, etc.), only those decoded in T5 (M)
- [~] T15 (UI built; the redesign is Phase 4): English UI polish, error states (device unplugged, unsupported browser), README (S)
### Checkpoint C: Complete
- [ ] Every v1 feature verified on the real keyboard, and a backup/restore round-trip works.


---

## Phase 4: One-screen redesign, live preview, per-key colours, profiles, release clean-up (added 2026-11-18)
Full reasoning, risks and open questions: `docs/internal/tasks/plan.md` "Phase 4". Rule change authorised by the user: design-related project rules may be rewritten when that makes the look, feel or design better (log each change in docs/internal/CONSTRAINTS.md). Hardware-safety rules (allowlist, backup first, read-back, never firmware/boot) are NOT design rules and stay.

Decisions: licence MIT; generic chevron logo mark; clean-up list approved (file list re-shown before deleting); minimum 1366x768 on one screen.

### Track A: foundations (no hardware)
- [x] **A1 Desktop-only disclaimer (XS).** DONE 2026-11-18 (notice below 1100x600, welcome card, README, narrow CSS removed; seen at 900 px) Shown on the connect screen, in the README, and as a full-page notice below the minimum width (proposal 1100px) instead of a squeezed layout. Remove the narrow-screen CSS added earlier.
  - Acceptance: a window under the minimum shows only the notice; at/above it the app works; README and welcome card say "desktop Chrome/Edge only".
  - Verify: iframe harness at 900 and 1280 px; `npm test`.
- [x] **A2 Design tokens + icon sprite (S).** DONE 2026-11-18 (tokens.css, icons.js with 20 icons, test/tokens.test.js guards raw colours and px) One token file (type scale, 4px spacing scale, radii, glass levels, motion) and an inline SVG sprite of ~20 icons (lighting, trigger, remap, advanced, performance, settings, profile, backup, restore, connect, apply, undo, check, alert, chevron...). Drawn in-house, no library, no MCHOSE assets.
  - Acceptance: no raw px/colour values outside the token file (a lint-style grep test); every icon renders at 16/20/24px in both themes.
  - Verify: icon test page screenshot; token grep test.

### Track B: one-screen shell and live preview (no hardware writes)
- [x] **B1 One-screen workspace shell (M)** DONE 2026-11-18 (rail | keyboard | inspector; no scroll at 1366x768 and 1920x945) (needs A2). Left rail (profile slots + section icons), centre keyboard, right inspector; no page scroll, no tabs hiding content. Minimal glass, perfect rhythm: 8px grid, consistent line heights, one type family with a 5-step scale.
  - Acceptance: at 1366x768, 1920x1080 and 2560x1440 nothing scrolls and nothing clips; every control from the four sections is reachable in the inspector; spacing audit shows only token values.
  - Verify: screenshots at the three sizes + a script measuring `scrollHeight <= innerHeight`; `taste-skill:design-taste-frontend` inspector.
- [x] **B2 Port Sensitivity / Remap / Lighting / Settings into the inspector (M)** DONE 2026-11-18 (all four fit; hardware smoke: one key written and restored through the Apply footer) (needs B1). Compact controls, progressive disclosure inside one panel. All existing behaviour and the 77 tests keep working.
  - Acceptance: every current function still works (stage, apply, discard, restore, backup); no feature lost.
  - Verify: `npm test` + lint + typecheck; hardware smoke: read, one key change, apply, restore.
- [x] **B3 Ace 75 drawing (S)** DONE 2026-11-18 (case, logo key in the shift row, LED strip, extras) (needs B1). Case/bezel, the logo key (generic chevron), the LED strip around the board, the Mute/RT extras placed where they really are.
  - Acceptance: the logo key and strip are separate, individually colourable shapes; layout test still passes (all 83 keys placed once).
  - Verify: screenshot; layout tests.
- [x] **B4 Effect engine (M)** DONE 2026-11-18 (src/ui/effects.js, 23 effects + logo/ambient, 8 tests) (independent). Pure `effectColor(effect, x, y, t, params)` for all 22 backlight effects + logo/ambient effects, using speed, direction, colour, brightness.
  - Acceptance: unit tests per effect (deterministic for fixed t; speed and direction change the output; brightness scales; own colour vs built-in colours).
  - Verify: `npm test`.
- [x] **B5 Live preview renderer (M)** DONE 2026-11-18 (src/ui/preview.js, 30 fps, staged settings, pauses when hidden). Still to do: the user compares 5 effects with the real keyboard (needs B3, B4). Canvas/DOM painter at 60 fps for keycaps, logo and strip from the *staged* settings; pauses when the tab is hidden; "preview" label.
  - Acceptance: changing effect/speed/colour/brightness updates the picture instantly, before Apply; CPU stays low (idle < 10% of one core on the dev machine).
  - Verify: screenshots over time of 5 effects; the user compares 5 effects with the real keyboard.

### Checkpoint: after A + B
- [ ] Tests, lint, typecheck green. [ ] One-screen at 3 sizes. [ ] Hardware smoke passes. [ ] User reviews the look before tracks C and D.

### Track C: hardware features (spikes first)
- [x] **S1 Per-key colour persistence spike (M, risky, hardware).** DONE 2026-11-18: persists across replug (cmd 10 table at 512*profile, 3 bytes per key row; shown when effect byte 0 = 0); no cmd 241 needed. Keyboard restored to baseline. C1 needs cmd 11 on the allowlist (user approval). Paint a key in the hub, "save", and diff keyboard memory (cmd 10 over a wide offset range, the settings block, other profiles) to find where the saved preset lives and what makes the keyboard show it. Two-tab method (hub + app can both read). May need read-only access to the custom-parameter area (cmd 241) = needs the user's approval.
  - Acceptance: a written answer in PROTOCOL.md: where it is stored, which commands persist it, what the keyboard shows after power-cycle/replug; or a clear "not possible safely".
  - Verify: the user looks at the keyboard.
- [x] **C1 Per-key colour UI + write (M)** DONE 2026-11-18 (cmd 11 allowlisted with approval, Custom colors effect, click-to-paint, backup carries colours, hardware-verified with the user's eyes, restored; 97 tests). Not hardware-tested: Fill all / Clear all, multi-key paint. (needs S1, B5). Paint keys on the preview; gated write with read-back; backup includes the colours; restore stages them.
  - Acceptance: painted colours are visible on the real keyboard, survive effect re-selection and unplug/replug, and read back; tests with real bytes.
  - Verify: hardware test by the user's eyes + read-back; restore to factory.
- [~] **S2 Profiles spike (S, read-only first).** DONE 2026-11-18 except a value-by-value hub comparison of profiles 2 and 3: active profile = cmd 4 byte 0 (verified with the hub); settings/keys per profile are read at 64*n / 1024*n; remap is shared. Read-only profile view built in the app (header buttons, tests 94). Switching the ACTIVE profile needs a write to the cmd-4 base block = not allowlisted, waiting for the user's approval. Read settings (`64*t`), key table (`1024*t`), remap (`512*(4*t+layer)`) for profiles 0..2; find how the active profile is selected (hub switch + diff; cmd 14 `setBase`).
  - Acceptance: PROTOCOL.md section: offsets verified against the hub's three board profiles, the active-profile mechanism, and the effect of switching.
  - Verify: hub comparison for all 3 profiles.
- [ ] **C2 Profile switcher (M)** (needs S2, B1). Rail shows the profiles; selecting one loads its data (read-only view of non-active profiles until write is proven); per-profile backup/restore; write only where verified.
  - Acceptance: switching shows each profile's own values matching the hub; editing the active profile works as before; nothing is written to a profile that was not backed up first.
  - Verify: tests with the mock (3 profiles); hardware: read all three, one verified write + restore.

### Checkpoint: after C
- [ ] Per-key colours really work or are documented as impossible. [ ] Profiles verified. [ ] Keyboard back at the user's state.

### Track D: release preparation (do last; deletions need the user's list confirmed)
- [x] **D1 Rewrite design-related rules (XS).** DONE 2026-11-18 (docs/internal/CONSTRAINTS.md rows: logo, keyboard picture, icons, allowlist; CLAUDE.md commands/structure refreshed). Update docs/internal/CONSTRAINTS.md / CLAUDE.md for what this phase changed (icons and fonts as in-repo assets, canvas allowed, CSP adjusted if needed, UI coverage target, desktop-only). Keep hardware-safety rules.
  - Acceptance: every changed rule is logged with its reason; no rule silently weakened elsewhere.
- [ ] **D2 Repo clean-up (S).** DONE 2026-11-18 (user confirmed the list). After the user confirms the list: remove `index.old.html`, `probe.html`, `KICKOFF.md`, `.groundbreaker/`; move internal notes under `docs/internal/`; no personal data (a path in `docs/internal/tasks/plan.md`); `.gitignore` complete; `package.json` metadata (description, repository, licence, keywords); keep `analysis/` out.
  - Acceptance: `git ls-files`-equivalent file list contains nothing personal, nothing copyrighted, nothing throwaway; CI artifact check still passes.
  - Verify: grep for personal strings; a dry-run file list shown to the user first.
- [x] **D3 Release docs (S).** DONE 2026-11-18 (LICENSE MIT 'Keytune contributors', README, CONTRIBUTING, CHANGELOG 0.1.0, SECURITY; screenshots NOT added yet). LICENSE (user's choice), README with screenshots and the desktop-only disclaimer, CONTRIBUTING (links ADDING_A_MODEL), CHANGELOG, security note.
- [~] **D4 CI and Pages dry run (S).** Local dry run DONE 2026-11-18: npm ci --dry-run ok, audit 0 vulnerabilities, grep guards ok, site artifact builds from the file list (34 js + logo.svg), tests/lint/tsc green. Create repo / push / Pages: waiting for the user's go. `npm ci`, tests, lint, typecheck, audit, artifact build locally as CI does; then (only on the user's go) create the repo, push, watch the first run, enable Pages.
  - Acceptance: CI green on GitHub; Pages URL loads and connects.

### Checkpoint: Release
- [ ] All acceptance criteria met. [ ] The user approves the push.
