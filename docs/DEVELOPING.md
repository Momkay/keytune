# Developing Keytune

Low-level notes for people who want to change the code, add a keyboard or understand the protocol. Users: see the [README](../README.md). Protocol evidence (what was verified on hardware and how) is in [PROTOCOL.md](../PROTOCOL.md); keep it up to date with every finding.

## 1. What it is
A static site: `index.html` plus ES modules in `src/`. No bundler, no framework, no runtime dependencies. Types are JSDoc checked by `tsc --checkJs`. It talks to the keyboard with **WebHID** (Chrome and Edge only, needs HTTPS or localhost). Hosted on GitHub Pages.

## 2. Run it
```
npm ci
npm test            # node --test with coverage (lines >= 80)
npm run lint        # eslint, zero warnings allowed
npm run typecheck   # tsc --noEmit
python -m http.server 8000 --bind 127.0.0.1   # then http://localhost:8000/
```
Chrome caches ES modules hard. After editing, hard-reload, or in DevTools tick "Disable cache".

## 3. Code map
```
index.html              page shell + strict Content Security Policy (meta tag)
src/transport/
  frame.js              build a request packet, parse and checksum a reply
  allowlist.js          the ONLY list of command bytes that may be sent
  device.js             exchange(), readBlock(); the ONLY file that calls sendReport
  discovery.js          which of the keyboard's USB interfaces may be opened
src/codecs/             pure byte <-> object functions (no DOM, no HID)
  key.js                8-byte per-key trigger row
  func.js               64-byte settings block (incl. lighting bytes)
  matrix.js             3-byte key remap entries
  colors.js             3-byte per-key colours
src/models/             one file per keyboard model + index.js (lookup by VID:PID)
src/safety/             gate.js (write gate), backup.js (validate an imported backup)
src/write.js            every write path: gate, validate, write, read back, compare
src/session.js          everything the UI needs from a keyboard; no DOM
src/ui/                 the interface (app.js is the shell; panel-*.js are the sections)
test/                   unit tests, a stateful mock keyboard in test/helpers/
```
Rules the code enforces (and CI greps for): only `src/transport/device.js` may call `sendReport`; `innerHTML`, `outerHTML`, `insertAdjacentHTML` and `eval` are banned in `src/` (elements are built with `h()` in `src/ui/dom.js`, which only creates text nodes); `analysis/` (official MCHOSE code kept locally for reading) is gitignored and must never be committed.

## 4. The wire protocol ("Frame B")
The keyboard exposes three USB HID interfaces. The configuration channel is the one with `usagePage 1, usage 0` that has **input and output report ID 0**. The other two are the normal keyboard, mouse and media interfaces; `discovery.js` refuses everything else, and the boot/update interface (`usagePage 0xFF00`) is never opened.

Vendor ID is `0x3837`. Ace 75 8K is product `0x303C` (16K guess: `0x301D`, unverified).

Every exchange is one 64-byte output report answered by one 64-byte input report. Offsets are 16-bit little endian.

```
request : 55 cmd 00 chk len offLo offHi 00 data...      (zero padded to 64 bytes)
reply   : AA cmd 00 chk size offLo offHi 00 data...
chk     : (len + offLo + offHi + 0 + sum(data)) & 0xFF        (replies use their own size byte)
```
- **Reads** ask for `len` bytes starting at `offset`. The device may answer with fewer; always use the reply's own `size`. Reads are chunked at 56 bytes (`readBlock`).
- **Writes** carry `len` data bytes. The ack echoes the command; it is not checksummed in the verified page, so `parseReply(..., isWrite)` skips the check.
- A reply is matched to its request by command byte and echoed offset; anything else is ignored. Timeout is 1.5 s per exchange.

### Commands (the allowlist)
Only these may be sent. Anything else is rejected before it reaches `sendReport`, and a test tries all 256 values.

| Cmd | Dir | Offset | Size | Meaning |
|---|---|---|---|---|
| 3 | read | 0 | 56 | info: 2 firmware bytes then an ASCII build string |
| 4 | read | 0 | 56 | **base block**: byte 0 = position of the active profile, byte 1 = profile count, bytes 2.. = profile order |
| 14 | write | 0 | 56 | write the base block (switches the active profile) |
| 5 | read | `64*profile` | 64 | settings block |
| 6 | write | `64*profile` | 64 | settings block (sent as two packets: offset 0 and offset 8, 56 bytes each, like the official app) |
| 7 | read | `512*layerIndex` | 3*128 | factory-default key matrix |
| 8 | read | `512*layerIndex` | 3*128 | live key matrix; `layerIndex = 4*profile + layer` |
| 9 | write | `512*layer + 3*row` | 3 | one remap entry |
| 0xA0 | read | `1024*profile` | 1024 | per-key trigger table (8 bytes per key) |
| 0xA1 | write | `1024*profile + 8*row` | 8 | one key's trigger struct |
| 10 | read | `512*profile` | 512 | per-key colour table (3 bytes per key) |
| 11 | write | `512*profile + 3*row` | 3 | one key's colour |

Never implemented, on purpose: firmware update, boot mode, reset or factory restore, and command 241 (the "custom parameter area", layout unknown).

### Data layouts (see PROTOCOL.md for the evidence)
Units: 1 raw unit = 0.01 mm. Key rows are matrix indexes (0..127), not physical order; use the model's `keymap`.

**Trigger struct (8 bytes, little endian)** `src/codecs/key.js`
| Byte | Field |
|---|---|
| 0 | low nibble switch type; high nibble always `0xA` |
| 1 | low nibble key mode (0 normal, 1 Rapid Trigger, 2 continuous), high nibble priority |
| 2-3 | 9 bits: actuation, stored as value minus 1 (so raw `0x95` = 1.50 mm) |
| 4-5 | 9 bits: Rapid Trigger press distance (value - 1); byte 5 bits 1-7 = press dead zone |
| 6-7 | 9 bits: Rapid Trigger release distance (value - 1); byte 7 bits 1-7 = release dead zone |

**Settings block (64 bytes)** `src/codecs/func.js`; only the listed bits are edited, every other byte is kept as read.
- `[4]` low nibble: polling rate (1k=4, 2k=3, 4k=2, 8k=1)
- `[6]` bit 0: Windows-key lock
- `[7]` bit 1: Rapid Trigger stability mode; bit 2: adaptive calibration; bits 5-7: debounce level (the app writes 7 for "on", 0 for "off")
- `[8..12]` backlight: effect, brightness 0-100, speed stored as `4 - level`, direction, "own colour" switch (stored inverted); `[14..16]` its colour. Effect `0` means "show the stored per-key colour table", `255` is off.
- `[20]` Rapid Trigger stability (0 off, 1..15)
- `[24..31]` ambient light and `[44..51]` logo light: effect, brightness, speed (`4 - level`), own colour (inverted), unused, r, g, b
- `[35]` sleep time in 30 s units; `[36]` = 1 means never sleep

**Key matrix entry (3 bytes)** `[type, code1, code2]`. Type `16` is a keyboard key: `code2` is the HID usage, `code1` a modifier bitmask. Other types (media, special) are kept raw until decoded; special (type 240) entries are never written. Layers: 0 Windows, 1 Windows + Fn, 2 Mac, 3 Mac + Fn. The matrix is shared by all three profiles on the Ace 75 8K.

**Colour table**: 3 bytes `[r, g, b]` per key row. It is stored in the keyboard (it survives replug) and is shown while the backlight effect is 0. Painting is one command 11 per key, so a "fill all" is 83 small writes followed by one read-back.

**Profiles**: the settings block, trigger table and colour table exist once per profile (3 on the Ace 75 8K). Reads of other profiles never change the active one. Switching is a write to the base block.

## 5. The write path
Nothing writes except through `src/write.js`, and every function there does the same thing:
1. `gate.assertCanWrite(model)`: refuses unless the model is `verified` **and** a backup was saved this session (`createWriteGate`).
2. Validate everything first (ranges from the model's `limits`, row is a named key, colours 0-255, remap entry is a writable type), before the first byte is sent.
3. Send the writes.
4. Read the area back and compare. The function returns the mismatches; `session.apply()` turns them into a loud error message. A write is never reported as success without a matching read-back.

`session.apply()` orders the work: backup (once per visit), key triggers, colours, settings block, remaps; then reloads everything from the keyboard so the screen shows what is really stored.

The UI never writes directly. User actions only change a **pending** object (`src/ui/pending.js`: staged keys, remaps, colours and settings, each dropped again if it equals what the keyboard already has). `Apply` hands that to the session.

## 6. Models
A model is one object in `src/models/<name>.js` (name, VID/PID, key map, physical layout, ranges, light effects, `verified`) and one line in `src/models/index.js`. **A model is `verified: true` only after a hardware test.** An unverified model is read-only in the UI and the gate refuses its writes. A USB device the registry does not know is never opened beyond producing a copy-and-paste report (`src/report.js`). Step by step: [ADDING_A_MODEL.md](ADDING_A_MODEL.md).

## 7. The interface
Plain DOM, no framework. `src/ui/dom.js` `h(tag, props, ...kids)` builds elements (text nodes only). `src/ui/app.js` is the shell and holds a shared `ctx` object that the panels use (`ctx.pending`, `ctx.changed()`, `ctx.rebuildPanel()`). The keyboard picture (`keyboard.js`) is built once from the model's layout; `paint()` updates labels and states, and `preview.js` drives the live light preview through `effects.js` (a pure function from effect, position and time to a colour, unit tested). Styles: `tokens.css` holds every colour, size and duration; `style.css` may only use those tokens (a test fails on raw values). Desktop only, one screen with no page scroll from 1366 x 768 up.

## 8. Tests
`node --test`, no framework. `test/helpers/mock-device.js` is a stateful fake keyboard (trigger table, settings block, matrix, colours, base block) that answers like the real thing, so the whole read, stage, apply and read-back flow runs in Node. Codec tests use **golden vectors**: real bytes captured from a keyboard, never invented ones. Rule: never weaken a test to get green (no skipped or deleted tests, no `@ts-ignore` or `eslint-disable` without a written reason). If behaviour legitimately changes, change the test and say why in the commit.

## 9. Hardware testing
Hardware tests change a real keyboard. The routine: save a backup, say what will change, change one thing, read it back, compare with what the official app shows if it shows that thing, **restore**, confirm the restore byte for byte, and record the result in `PROTOCOL.md` (what was tried, the exact bytes, what is still unverified). A feature is only done after that.

Useful tricks: Chrome lets the same page and the official app both read the keyboard at once in two tabs, so you can diff memory before and after an official-app change. The official web app's code (kept in your local, gitignored `analysis/` folder) is the best map of the protocol; do not copy it into the repo.

## 10. CI and release
`.github/workflows/ci.yml` runs on every push and pull request: `npm ci`, tests, lint, typecheck, `npm audit --omit=dev`, grep guards (no `sendReport` outside the transport, no `innerHTML`/`eval`, no `analysis/` folder), then builds the site from an explicit list (`index.html` and `src/`), so nothing else can be published by accident. On `main` it deploys that folder to GitHub Pages. Actions are pinned by commit SHA.

To release: update `CHANGELOG.md` and the version in `package.json`, make sure CI is green on `main`, tag it. Pages redeploys on the push.

## 11. Quality bar
`docs/internal/CONSTRAINTS.md` holds the written quality bar (coverage, lint, accessibility, performance, the allowlist, the design rules and every time one was rewritten and why). `docs/SPEC.md` and `docs/ARCHITECTURE.md` hold the original specification and decisions.
