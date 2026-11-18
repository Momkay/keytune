# MCHOSE Ace 75 English Web Configurator: Plan

## Context
The official MCHOSE web app is Chinese and slow. We want a fast English replacement that runs in Chrome/Edge via WebHID and can change every setting the keyboard supports. The protocol is undocumented, so work is: analyse, decide, build. Greenfield: the repository was empty. On approval, this plan is copied to `docs/internal/tasks/plan.md` and the checklist to `docs/internal/tasks/todo.md`.

## Architecture decisions
- Single static page (HTML + ES modules, no build, no deps), served on localhost. WebHID needs a secure context.
- Protocol layer (`hid.js`) is separate from UI, so decoding fixes never touch the UI.
- Safety: read before write, config backup to JSON before any write, never send anything resembling a firmware-update command.
- USB only (WebHID does not work over Bluetooth/2.4G).

## Task list

### Phase 1: Analysis (read-only, no keyboard writes)
- [ ] T1: Get the official web app URL from the user; fetch the page and its JS bundles into `analysis/` (S)
  - Accept: bundle files saved locally; entry point identified.
  - Verify: file list in `analysis/README.md`.
- [ ] T2: Find the WebHID usage: vendorId/productId filters, usagePage, reportId, `sendReport`/`inputreport` handlers (S)
  - Accept: device filter values and report IDs written down.
  - Verify: cite file+line for each in `PROTOCOL.md`.
- [ ] T3: Decode packet layout: command bytes, payload format, checksum, response parsing (M)
  - Accept: a table of command, direction, bytes, meaning.
  - Verify: re-derive two commands independently from the source.
- [ ] T4: If the code is obfuscated, capture live traffic in Chrome (chrome://device-log or a WebHID logger) while changing one setting at a time (M, conditional)
  - Accept: before/after packet pairs for each setting.
  - Verify: diff of packets matches the single changed value.
- [ ] T5: Write `PROTOCOL.md`: every feature (actuation, rapid trigger, remap, RGB, macros, layers, polling rate, calibration) marked decoded, guessed or unknown (S)
  - Accept: no feature missing from the table.

### Checkpoint A: Analysis
- [ ] `PROTOCOL.md` reviewed by the user; the Phase 2 decisions are made from it.

### Phase 2: Decide
- [ ] T6: Choose v1 scope from the decoded features, and mark risky ones (macros, calibration) as later (XS)
- [ ] T7: Confirm the stack (static page and localhost) and the safety rules (XS)

### Checkpoint B: Scope approved by the user

### Phase 3: Build (vertical slices)
- [ ] T8: Connect button plus a read-only dump of the current config (S)
  - Accept: device connects, config prints, matches the official app's values.
  - Verify: manual compare with the official app.
- [ ] T9: Backup and restore config to a JSON file (S)
  - Accept: export then import round-trips with no diff.
- [ ] T10: Write one setting: actuation distance for one key (M)
  - Accept: the value changes on the board and survives replug.
  - Verify: read back, and confirm in the official app.
- [ ] T11: Per-key 75% layout view; actuation and rapid trigger for all keys (M)
- [ ] T12: Key remap and layers (M)
- [ ] T13: RGB and lighting (M)
- [ ] T14: Remaining features (polling rate, macros, etc.), only those decoded in T5 (M)
- [ ] T15: English UI polish, error states (device unplugged, unsupported browser), README (S)

### Checkpoint C: Complete
- [ ] Every v1 feature verified on the real keyboard, and a backup/restore round-trip works.

## Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Obfuscated or minified official code | Med | T4 traffic capture fallback |
| A wrong packet corrupts settings | High | Backup first, read-only first, one key per test |
| Firmware update changes the protocol | Med | Record the firmware version in `PROTOCOL.md` |
| Official app is login/cloud gated | Low | Capture traffic from the desktop app instead |

## Open questions
- Official web app URL (needed for T1).
- Wired USB confirmed for testing?

## Verification
Each build task is checked on the real board (read back after write, replug, compare with the official app). There are no automated tests for hardware; the protocol encode/decode functions get small assert-based self-checks.


---

# Phase 4: One-screen redesign, live lighting preview, per-key colors, profiles, release clean-up
Added 2026-11-18. Continues the same project; phases 1-3 above are done (see `docs/internal/tasks/todo.md`).

## Overview
The app works and is hardware-verified, but it does not feel like a product yet. The user wants:
1. **Desktop only**, stated as a disclaimer (no tablet or phone work).
2. **The MCHOSE hub feel:** icons, and the Ace 75's own features drawn on the keyboard picture: the logo key, the LED strip, and a **real preview of the colour effects** (the keyboard animates the chosen effect).
3. **One screen instead of tabs and scrolling**, minimal glass design, perfect spacing, line heights and type.
4. **Per-key colours done properly** (the earlier attempt did not persist; see PROTOCOL.md "Per-key custom lighting: NOT supported").
5. **Other profiles** (the hub has 3 board profiles; the app only handles profile 0).
6. **A clean repo, ready for release later** (push to GitHub still waits for the user's go).
Accessibility stays "nice to have": keep what exists, no new accessibility work, no screen-reader testing.

## Architecture decisions
- **Layout: a fixed three-zone workspace that fits the viewport** (no page scroll, no tabs that hide content): a narrow left rail (profiles + section icons), the keyboard preview in the middle (always visible, always live), and an inspector on the right with the controls of the chosen section. Sections switch the inspector content, not the page. Target viewports 1366x768 up to 2560x1440; below 1100px wide show the desktop-only notice instead of squeezing.
- **Design system first:** one token file (type scale, 4px spacing scale, radii, glass levels), one icon sprite. Every later screen only uses tokens, so "perfect spacing" is enforced in one place. Use `taste-skill:design-taste-frontend` (the installed art-direction skill; there is no skill literally named frontend-design) for the look, plus its real-browser inspector for the spacing check.
- **Icons:** hand-drawn inline SVG sprite (about 20 simple stroke icons: lighting, trigger, keys, advanced, performance, settings, profile, backup, restore, connect...). No icon library and no copied MCHOSE assets (no dependency, no licence text, no brand assets).
- **Ace 75 drawing:** the keyboard picture gets the case, the logo key (a generic chevron mark, not MCHOSE's artwork; see open question) and the LED strip around the board. The logo key and the strip are the "logo light" and "ambient light" from slice 6 and are painted with their live colours.
- **Live effect preview:** a small pure engine `effectColor(effect, x, y, t, params) -> rgb` (testable, no DOM) plus a renderer that paints the keycaps, logo and strip with requestAnimationFrame. It previews the staged (unapplied) settings, so people see the result before pressing Apply. The 22 backlight effects are approximations from their names and the official capability table (speed, direction, colour); this is stated in the UI ("preview, not exact").
- **Per-key colours: spike first.** Commands 10/11 only fill a temporary buffer. Find how the hub makes a painted preset permanent (and where the keyboard keeps it) by painting in the hub and diffing keyboard memory, before any UI is built. Allowlist changes need the user's approval again.
- **Profiles: spike first.** Settings are at `64*t`, key triggers at `1024*t`, remap layers at `512*(4*t+layer)` for profile `t` (official code). Reading other profiles is read-only and safe. Open: which byte or command selects the *active* profile (official `setBase`, cmd 14, not allowlisted) and what "3/3" means. Everything profile-related is read-only until the spike says otherwise.
- **Rules:** the user authorised rewriting design-related project rules whenever that gives a better look, feel or design (e.g. icon/font assets in the repo, canvas, CSP style limits, the UI coverage gate). Each change is logged in docs/internal/CONSTRAINTS.md. Hardware-safety rules are not design rules and are kept.
- **Clean-up is deletion of throwaway files, done last, with a list the user confirms** (nothing is deleted without that).

## Dependency graph
```
A1 desktop notice ───────────────┐
A2 design tokens + icons ──► B1 one-screen shell ──► B2 port the 4 sections into the inspector ─┐
                              │                                                                │
                              └► B3 Ace 75 drawing (logo, strip) ──► B4 effect engine ──► B5 live preview ─┤
S1 per-key colour spike ───────────────────────────────────────────────► C1 per-key colour UI ──────────┤
S2 profiles spike ──► C2 profile switcher + per-profile data ─────────────────────────────────────────┤
                                                                                          D1..D4 release
```
Spikes (S1, S2) need the real keyboard and the hub, so they run first and in parallel with the UI work that does not depend on them (A, B).

## Risks and mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Per-key colours cannot be made permanent without the hub's save mechanism (command 241 area) | High | Spike S1 with a hard stop: if after the spike there is no safe, allowlist-able way, say so and keep the feature out; do not ship a control that reverts |
| Effect previews look different from the real keyboard | Medium | Label as preview; compare 5 effects side by side with the real keyboard (the user can look) and adjust |
| One-screen layout is too dense for the Sensitivity controls | Medium | Inspector uses compact controls and progressive disclosure inside one panel (no scroll); verify at 1366x768 first, the tightest target |
| Profile switching writes to the active-profile selector, which could confuse the keyboard | High | Read-only until decoded and hub-verified; backup first; restore and confirm; stop and ask before any new command |
| Redesign breaks the verified write paths | High | UI only calls `session.js`; the 77 existing tests plus a hardware smoke (read, one write, restore) after each UI slice |
| Brand/trademark: drawing the MCHOSE logo | Medium | Generic mark only; disclaimer already says unofficial; ask the user |
| Repo clean-up deletes something needed | Medium | List first, user confirms, then delete; `analysis/` stays gitignored and never published |

## Decisions (answered by the user 2026-11-18)
1. **Licence: MIT.**
2. **Logo key: generic chevron mark**, not MCHOSE's artwork.
3. **Clean-up approved:** delete `index.old.html`, `probe.html`, `KICKOFF.md`, `.groundbreaker/`; move `tasks/`, `docs/internal/CONSTRAINTS.md`, `docs/internal/PLAN.md` under `docs/internal/`. The exact file list is shown again right before deleting.
4. **Minimum desktop size: 1366 x 768** must fit on one screen without scrolling; below 1100 px wide show the desktop-only notice.

## Superseded open questions (kept for the record)
1. **Licence** for the repo (MIT is the usual choice for a tool like this).
2. **Logo key artwork:** OK to use a generic chevron mark instead of MCHOSE's own logo?
3. **Delete list** for the clean-up: `index.old.html`, `probe.html`, `KICKOFF.md`, `.groundbreaker/`, and moving internal notes (`tasks/`, `docs/internal/CONSTRAINTS.md`, `docs/internal/PLAN.md`) under `docs/internal/`. Confirm before anything is removed.
4. Minimum desktop size to support (proposal: 1280x720 and up).
