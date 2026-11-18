# Spec: Keytune

## Objective
The official MCHOSE M HUB is Chinese and slow. This tool is a fast English web page that reads and changes the settings of MCHOSE magnetic keyboards over USB (WebHID), starting with the Ace 75 8K (VID 0x3837, PID 0x303C), and grows to other models only when each is verified on real hardware. Success: every setting the official hub offers for the Ace 75 can be read and changed here, with the same result confirmed in the hub, and a first page load plus a connect takes under 3 seconds on a normal PC.

## Users
- Primary: the owner of an Ace 75 8K who wants an English, quick configurator.
- Secondary: other MCHOSE owners who can help verify their model.

## Scope
**MVP (done or in progress):** connect, read, backup, per-key actuation / rapid trigger mode (0/1/2) / RT press, release / deadzones, settings block (polling rate, RT stability, stability mode, adaptive calibration, debounce, Win lock, sleep).
**Next:** key remap and layers, RGB, "separate press/release sensitivity", polling-rate write test, restore-from-backup flow with diff preview, model registry for other models (read-only first), GitHub Pages deploy.
**Non-goals:** firmware updates or any boot-mode command, reflashing, cloud profiles/community, macros until decoded, Bluetooth/2.4G (WebHID is USB only), mobile browsers.

## Features and acceptance criteria
1. **Connect.** Given the keyboard on USB and no other page holding it, when the user clicks Connect and picks the device, then the page shows the model name. It never opens the boot-mode interface. Reconnects silently while Chrome still holds the grant.
2. **Read.** Reading returns the settings block and the 128-row key table, every packet checksum-verified, and renders named keys in physical order (83 named keys for the Ace 75 8K).
3. **Backup.** "Download backup" always reads live values and writes a JSON file (schema: device, profile, readAt, infoHex, funcHex, keysHex). Apply buttons stay locked until a backup was taken in the session.
4. **Edit keys.** Given changed rows, when Apply is pressed, then only changed rows are written, the whole table is read back, and the status says "confirmed by read-back" or lists mismatched keys. Out-of-range values are rejected before the first write.
5. **Edit settings.** Settings are written as the official app does (whole 64-byte block, only the edited bits changed), then read back; any mismatch in an edited byte is reported.
6. **Restore.** Loading a backup fills the table and settings controls and changes nothing until Apply; a file for another model or with out-of-range values is rejected with a reason.
7. **Safety.** Only allowlisted commands are sent; unverified models cannot write; a write error never leaves the UI claiming success.
8. **Models.** Adding a model means adding one profile file (IDs, keymap, limits, verified flag) and tests; no change to the transport.
9. **Hosting.** Deployed from CI to GitHub Pages over HTTPS, with a visible "not affiliated with MCHOSE, use at your own risk" notice, and without `analysis/`.

## Data and integrations
Entities: device profile (static), backup JSON (user file), live keyboard memory (commands 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 0xA0, 0xA1 over report ID 0 for Frame B). No servers, accounts, analytics or network calls at runtime. Auth model: none; the browser's device picker is the permission boundary.

## Threat model
Assets: the keyboard's configuration and firmware integrity; the user's trust.
Entry points: the HID device picker, imported backup files, the hosted page itself (supply chain).
| Threat | Mitigation (acceptance criterion) |
|---|---|
| Bricking via a firmware/boot/reset command | allowlist in transport; test sends every non-allowlisted byte and expects a rejection; boot interface filter test |
| Tampered or wrong-model backup JSON | schema, model, length and range checks; diff preview; malformed-file tests |
| Writing to the wrong or unverified device | VID/PID + usage-page filter; `verified:false` models have no write function (registry test) |
| XSS via imported names or reflected data | text content only; innerHTML banned everywhere (lint + CI grep), elements built with `h()`; strict CSP; lint grep |
| Supply chain / tampered deploy | zero runtime dependencies; Actions pinned by SHA; minimal permissions (`pages: write`, `id-token: write`) |
| Partial write or power loss mid-apply | backup first, read-back compare, loud MISMATCH message |

## Hardware release checklist (manual, Ace 75 8K)
Connect; read; download backup; change one key and one setting; confirm read-back; confirm in the official hub (translate it); restore; confirm read-back again; unplug/replug and reconnect; record results in PROTOCOL.md.

## Assumptions (confirm)
- ASSUMPTION: publishing byte layouts and key names derived from the official app is acceptable; MCHOSE JS itself is never published.
- ASSUMPTION: Chrome and Edge only (WebHID); Firefox/Safari unsupported.
- ASSUMPTION: Node >= 22.8 in CI for the coverage threshold flag.
- ASSUMPTION: GitHub Pages "Enforce HTTPS" is on and the workflow uses `upload-pages-artifact` + `deploy-pages` (check current docs when writing the workflow).

## Open questions (ranked by risk)
1. Which other models next, and does the user own them? Writes stay off without hardware tests.
2. ~~Debounce on-value~~ ANSWERED: the hub writes 7 when on, 0 when off (see PROTOCOL.md).
3. ~~Polling-rate write~~ ANSWERED: no USB re-enumeration on the Ace 75 8K (see PROTOCOL.md).
4. Whose name goes on the public repo and the disclaimer?
