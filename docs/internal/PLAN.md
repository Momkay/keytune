# Plan

Riskiest unknowns go early. Each slice is at most about a day and ends with a working page.

Slice 0: Restore the keyboard | depends on: none | size: S
  Delivers: the keyboard back at its original settings, hub-verified.
  Tasks: [ ] follow "RESUME HERE" in docs/internal/tasks/todo.md: verify Win lock / RT stability 6 / sleep 4 / debounce 1 in the hub performance tab, then restore 5 / 3 min / debounce 0 / Win lock off.
  Acceptance: read-back shows the original block (backup of 16:51:14Z); hub shows Win lock off, RT stability 5, sleep 3, debounce off.
  Risks: the hub tab and index.html cannot hold the keyboard at the same time.

Slice 1: Modules, tests, CI | depends on: none | size: M
  Delivers: same behaviour as today's `index.html`, split into `src/`, with a test suite and CI.
  Tasks: [ ] package.json with `test`, `lint`, `typecheck` scripts [ ] extract frame-b, allowlist, device, key/func codecs, ace75-8k model [ ] golden vectors from PROTOCOL.md (e.g. request `55 a0 00 08 08 00 00 00`, reply `aa a0 00 b3 08 00 00 00 a0 00 95 00 1d 1e 1d 1e`, cmd 3 reply with length 31 and checksum 0x28, key row round trip) [ ] mock HID device [ ] GitHub Actions workflow running the three commands
  Acceptance: `npm test` green with coverage >= CONSTRAINTS thresholds; a manual hardware smoke (connect, read, one-key write + restore) behaves exactly as before.
  Risks: breaking the verified write path while refactoring; keep the old `index.html` until the smoke test passes.

Slice 2: Safety layer | depends on: 1 | size: M
  Delivers: allowlist enforced in the transport, backup-before-write gate in code, import validation with diff preview, CSP.
  Acceptance: tests for every denied command byte, malformed/wrong-model/out-of-range backups, unverified model has no write.
  Risks: the allowlist must still cover the settings write (cmd 6, offsets 0 and 8, 56 bytes).

Slice 3: Remap decode spike (read-only) | depends on: 1 | size: M
  Delivers: PROTOCOL.md section for the 128 x 3-byte key matrix, layers, Win/Mac and Fn layers, verified by reading and comparing with the hub's remap tab.
  Acceptance: decoded bytes match what the hub shows for at least 5 keys on 2 layers; no writes yet.
  Risks: biggest unknown (code types 16 / 240 / 48 / 128 seen in the official SDK).

Slice 4: Deploy to GitHub Pages | depends on: 1, 2 | size: S
  Delivers: HTTPS site from CI with the disclaimer and without `analysis/`.
  Acceptance: the Pages URL loads, WebHID connect works on it, CI fails if `analysis/` is in the artifact. You create the repo and enable Pages; the workflow follows the current GitHub docs (`upload-pages-artifact`, `deploy-pages`, `pages: write`, `id-token: write`), actions pinned by SHA.

Slice 5: Remap write + UI | depends on: 3 | size: L
  Acceptance: remap one key, read back, hub shows the change, restore; golden-vector tests.

Slice 6: RGB | depends on: 3 | size: L (decode first, then write)
Slice 7: Separate press/release sensitivity + debounce on-value + polling-rate test | depends on: 2 | size: M
Slice 8: Model onboarding (docs + registry, read-only for new models) | depends on: 2 | size: M | DONE (see docs/internal/tasks/todo.md)
Slice 9: UI polish and accessibility pass via `agent-skills:frontend-ui-engineering` | depends on: 1 | size: M | DONE (see docs/internal/tasks/todo.md)
