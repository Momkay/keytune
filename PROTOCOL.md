# MCHOSE magnetic-keyboard protocol (from official M HUB code; WORK IN PROGRESS)

Source: https://www.mchose.com.cn/cizhou/CZ_SHARED_DATA/main.*.js (saved in analysis/cz/). Status key: DECODED / PARTIAL / UNKNOWN.

## Transport (DECODED)
- WebHID, output report ID **77 (0x4D)**, packet 63 bytes data (boot/FW path) / 31 normal. Music/lighting stream uses report ID 78.
- (Superseded: the 0x41E4 IDs earlier were a different device family, not the Ace 75. See Ace 75 section.)
- Frame: `[version, flags, length, cmdLo, cmdHi, bizCode, sequence] + data[length] + checkCode`; HEADER_LENGTH = 7.
- Sequence id increments, masked to 8 bits.

## Ace 75 identity (DECODED from device table in SDK main.js)
- Vendor ID **0x3837 (14391)**.
- **Ace 75 16K:** PID **0x301D (12317)**, boot PID 0x301F, wired only, type 135, marked `isTesting`.
- **Ace 75 8K:** PID **0x303C (12348)**, boot PID 0x303D, wired only, type 134, firmware >= 114.
- `hidFilters`: `{usagePage:1,usage:0}` (normal keyboard) and `{usagePage:65280 (0xFF00),usage:1,boot:true}` (boot/update mode only; never touch).
- Ace 75 entries have no `manufacturer` field, and the SDK defaults to **"glw"**, so the Ace 75 should use **Frame B (legacy)**, not the "qhw" Frame A. Verify on hardware.
- Switch options, precision (0.001/0.005/0.01 mm), RT double click, light calibration are listed as supported features.

## CONFIRMED on user's hardware (2026-11-18)
- Keyboard is **Ace 75 8K**, VID 0x3837, PID 0x303C, name "Ace 75", exposes 3 HID interfaces.
- Config channel = the interface with usagePage 0x01, usage 0, **input and output report ID 0** (matches `hidFilters` and Frame B). The other two interfaces are normal keyboard/mouse/consumer and must not be used.

## VERIFIED on hardware: Frame B read (2026-11-18)
Sent `55 a0 00 08 08 00 00 00` + zero pad to 64 bytes via sendReport(0). Reply (64 bytes, input report 0):
`aa a0 00 b3 08 00 00 00 | a0 00 95 00 1d 1e 1d 1e | 00...`
- Reply header = `[0xAA, cmd, 0, chk, size, offLo, offHi, 0]` then `size` data bytes, rest zero.
- **chk = (size + offLo + offHi + 0 + sum(data)) & 0xFF**: verified: data sum 0x1AB + size 8 = 0x1B3, &0xFF = 0xB3. Same rule for requests (no data on reads).
- Key 0 trigger data (command 0xA0, profile 0, offset 0): `a0 00 95 00 1d 1e 1d 1e` (layout UNKNOWN; candidates: u16 LE 0x00A0=160 and 0x0095=149, then four bytes 29,30,29,30).

## Per-key trigger struct, command 0xA0 read / 0xA1 write (DECODED from SDK `Oe`/`Te`, consistent with hardware dump)
8 bytes per key, key index = row number, profile block = 1024 bytes at offset `1024*profile` (up to 128 keys). Little-endian 16-bit fields.
| Byte | Bits | Field |
|---|---|---|
| 0 | low nibble | switchType; high nibble is always 0xA on write (`160 | switchType`) |
| 1 | low nibble / high nibble | keyMode / priority |
| 2, 3 bit0 | 9 bits | keyActuation = value + 1 |
| 3 | bits 3-4 / bits 1-2 | pressPrecision / releasePrecision (0.01 / 0.005 / 0.001 mm via `precisionConfig`; mapping of 0..2 UNVERIFIED) |
| 4, 5 bit0 | 9 bits | rtPress = value + 1 |
| 5 | bits 1-7 | pressDeadzone |
| 6, 7 bit0 | 9 bits | rtRelease = value + 1 |
| 7 | bits 1-7 | releaseDeadzone |
Your dump (all 128 keys identical): `a0 00 95 00 1d 1e 1d 1e` = switchType 0, keyMode 0, priority 0, keyActuation 150, precisions 0, rtPress 30, pressDeadzone 15, rtRelease 30, releaseDeadzone 15. **Units VERIFIED against the official hub UI (2026-11-18): 1 unit = 0.01 mm.** Hub shows actuation 1.50 mm (raw 150), RT sensitivity 0.30 mm (raw 30, RT toggle OFF), top deadzone 0.15 mm (raw 15). RT on/off is NOT stored in the value bytes; keyMode (byte 1 low nibble) reads 0 while RT is off, so it is the likely switch (UNVERIFIED).
Write: `0xA1`, offset `1024*profile`, data = 8 bytes per key, chunks of up to 56 bytes (multiple of 8). Whether a commit/save step is needed after writing is UNKNOWN.

## "Performance info" block (getFuncConfig, byte layout from SDK, offsets unverified)
e[1]&15 macMode, e[4]&15 reportRate, e[4]>>4 tickRate, e[5] deadZone, e[6] bit0 lockWin / bit1 lockAltTap / bit2 lockAltF4, e[7] bit0 tachyonMode / bit1 bottomRapidTriggerMode / bit2 travelCheck / bit3 debugMode / bits5-7 debounceLevel, e[20] rtsmart, e[32] battery, e[35] sleepTime. Command number and offset for reading this block: NOT yet found.

## More commands (from SDK, command + offset + size; Frame B, reads chunk at 56 bytes)
| Cmd | Dir | Offset | Size | Meaning |
|---|---|---|---|---|
| 3 | get | 0 | 56 | getInfo |
| 4 | get | 0 | 56 | getBase |
| 5 | get | 64*profile | 64 | **func config / "performance info" block** (layout in section above) |
| 6 | set | 64*profile | 64 | write func config |
| 14 | set | 0 | n | setBase |
| 0xA0 / 0xA1 | get / set | 1024*profile | 1024 | key triggers |
No commit/save command was found: the SDK's set calls are plain writes. Verify on hardware (replug test) before trusting.

## VERIFIED: reply length can be shorter than requested (cmd 3, 2026-11-18)
Cmd 3 read (offset 0, asked 56) returned size byte 0x1F = 31: `18 01 | "Jul 30 2026,17:07:58GL8KH-PRO"` (firmware version bytes `18 01` then build string; likely "GLW 8K H-PRO" build). Checksum must use the reply's own size byte (r[4]), not the requested size. Confirms `glw` frame B for this keyboard.

## VERIFIED WRITE (2026-11-18, via index.html in Chrome)
Write = Frame B, cmd 0xA1, offset `8*key` (profile 0), len 8, packet `[0x55, 0xA1, 0, chk, 8, offLo, offHi, 0, ...8 key bytes]`, `chk = sum8([len, offLo, offHi, 0, ...data])`. Device replies `aa a1 ...` (page accepts any `aa a1` reply). Single-key read-modify-write works: key 0 actuation 150 -> 160 -> 150, each confirmed by read-back. No commit/save command needed for the value to apply. **Persistence VERIFIED: key 0 = 160 survived an unplug/replug; writes persist without a save command.** NOT yet tested: effect on actual key feel, writing multiple keys, other profiles.

## VERIFIED: multi-key apply from index.html (2026-11-18)
Wrote key 1 actuation 150->155 and key 2 actuation 150->145 + pressDeadzone 15->20 in one Apply (two 8-byte 0xA1 writes), full 1024-byte read-back matched; then restored both to 150/15, read-back matched. Per-key fields written independently; other keys untouched.

## Key order / index map for Ace 75 8K (DECODED from official data; hardware-verified on Esc)
Source: `default-keys-ace75_8k.*.js` (each key has `index`, `code`, `name`) joined by key code to `layout-ace75_8k.*.js` (each key has x, y). Saved in analysis/cz/ace75_8k_keynames.json (index -> name) and embedded in index.html as KEYMAP.
- The trigger table has 128 rows x 8 bytes; matrix key table has 128 x 3 bytes. The index is a matrix position, NOT physical order, and runs 0..93 (not 0..74): 83 named entries (79 layout keys + Space 13, FN1 22, Mute 92, RT 93). Unused rows (3, 12, 23, 25, 38, 42, 47, 60, 64, 72, 76, 94..127) are blank.
- Examples: Esc=31, F1=77, Space=13, W=90, A=88, S=89, D=91, Enter=46, LShift=62, RShift=24, LCtrl=40, RCtrl=52, LAlt=20, Win=84, arrows Up=10 Left=68 Down=32 Right=54.
- **VERIFIED for all 79 labelled keys (2026-11-18):** wrote unique actuation = 100 + row to 82 keys in one Apply (read-back matched), then read the official hub trigger screen: every one of the 79 keys shown there displayed exactly (100+row)/100 mm for its name (e.g. Esc 1.31, F1 1.77, W 1.90, Space 1.13, Right 1.54). Not visible/checked in the hub: FN1 (22), Mute (92), RT (93). Everything restored to 150 afterwards (read-back matched).
- Earlier single-key check, row 31 (Esc): set row 31 actuation to 175 via index.html; the official hub's Trigger tab then showed 1.75 on Esc and 1.50 on every other key. So trigger-table row == this index (a wrong mapping would have changed another key). Other rows follow the same source data but were not each checked individually. Esc restored to 150 afterwards.

## Rapid trigger on/off = keyMode (byte 1 low nibble) (VERIFIED on hardware 2026-11-18)
From the hub's UI chunks (analysis/cz/next/*.js): the RT switch writes `keyMode: on ? 1 : 0`; the "continuous rapid trigger" switch writes `keyMode: on ? 2 : 1`; the UI shows the RT badge on a key when `keyMode === 1 || keyMode === 2`.
- keyMode 0 = rapid trigger off (matches the dump: all keys 0 while hub shows RT off)
- keyMode 1 = rapid trigger on
- keyMode 2 = continuous rapid trigger
- The hub's RT presets also set pressDeadzone/releaseDeadzone to 0 and use rtPress/rtRelease values; they leave switchType 0.
- "Set press and release sensitivity separately" is NOT in this byte: it lives in a separate struct (getRtSeparateStruct / getRtMilliDigits commands, not decoded yet). Until then rtPress and rtRelease are stored per key, but the hub may link them when separate mode is off.
- **Hardware test:** set Esc (row 31) keyMode 0 -> 1 via index.html, read-back confirmed; the official hub then showed, with only Esc selected, the RT switch ON (sensitivity 0.30 mm), tooltip "rapid trigger mode: enabled" and "continuous rapid trigger: not enabled". Esc restored to keyMode 0, read-back confirmed. keyMode 2 (continuous) was not tested on hardware.
- **keyMode 2 VERIFIED (2026-11-18):** Esc set to 2; hub showed RT switch on, "continuous rapid trigger" switch on, tooltip "continuous rapid trigger: enabled". keyMode 2 = continuous RT.
- index.html has a keyMode dropdown (0/1/2).

## Settings block vs hub performance tab (2026-11-18, read-only comparison)
Hub (translated) showed: report rate 8k selected (options 1k/2k/4k/8k); "RT stability" ON, slider at 5 (range 1 extreme .. 15 stable); "stability mode (anti-mis-touch)" ON; "key debounce optimisation" OFF; "adaptive dynamic calibration 2.0" ON; sleep 3 minutes; Win lock OFF; Mac mode OFF.
Our decode of cmd 5 for the same state: reportRate=1, rtsmart=5, deadZone=1, bottomRapidTrigger=1, travelCheck=1, tachyonMode=0, debounceLevel=0, sleepTime=6, lockWin=0, macMode=0.
- MATCH: rtsmart (e[20]) = RT stability slider (5); lockWin (e[6] bit0) = Win lock off; macMode = Mac mode off; debounceLevel 0 consistent with debounce optimisation off (unconfirmed).
- reportRate raw 1 <-> 8k (only one data point; raw values for 1k/2k/4k unknown).
- sleepTime raw 6 <-> 3 minutes: unit probably 0.5 min per step (unconfirmed).
- UNRESOLVED: which of deadZone(e[5])=1, bottomRapidTrigger(e[7] bit1)=1, travelCheck(e[7] bit2)=1 is "stability mode" and which is "adaptive dynamic calibration 2.0" (both ON in hub). Needs a toggle test.

## Settings block write (cmd 6) and byte meanings (DECODED from official code, hardware-verified by read-back 2026-11-18)
Write = whole 64-byte block (official does this): packet 1 = offset 0, 56 bytes; packet 2 = offset 8, 56 bytes (the last chunk is re-sent from offset 8 so every packet is full). Only these bits are edited, other bytes are kept as read:
- e[4] low nibble = polling rate; glw raw values 1k=4, 2k=3, 4k=2, 8k=1 (16k=0, 32k=5 on other models). Upper nibble = tickRate. Only written when changed. NOT tested on hardware (may re-enumerate USB).
- e[6] bit0 = Win key lock (hub: "Win key lock"). bits1,2 = lockAltTap, lockAltF4 (not shown in hub).
- e[7] bit0 tachyonMode (hub: Berserk mode 3.0, not exposed), bit1 bottomRapidTrigger = hub "stability mode (anti-mis-touch)", bit2 travelCheck = hub "adaptive dynamic calibration 2.0", bits5-7 debounceLevel (hub toggle: on when >= 1; the on-value the hub writes is unknown, index.html uses raw 0-7).
- e[20] = RT stability: 0 = off, 1..15 (1 extreme, 15 stable); hub slider showed 5 for raw 5.
- e[35] sleep time in 30 s units (raw 6 = 3 min; hub range 1-30 min = raw 2..60); e[36] = 1 means never sleep.
- e[5] deadZone, e[32] battery, e[33], e[34], e[37], e[38] untouched.
Test applied via index.html (confirmed by read-back, hub view not yet checked): Win lock on, RT stability 6, sleep 4 min, debounce 1. Keyboard stayed connected, polling rate unchanged. NOT yet restored (see tasks/todo.md).

## Two framings found in the SDK (DECODED from code; which one the Ace 75 uses is UNCONFIRMED)
**A. "Qhw" frame** (report ID 77, class `Ue`): `version=1, flags=3`. Bytes sent:
`[1, 3, len, cmdLo, cmdHi, bizCode(0), seq, ...data, chk]` where `chk = XOR of every byte from flags(index 1) to the last data byte`. 16-bit values are little-endian. Normal payload max 31 bytes, boot/FW path 63.
Read request data = `[...prefix, offsetLo, offsetHi, size]` (offset size 2 bytes, or 1 byte in some JSON reads).

**B. Legacy frame** (report ID 0, class `$`, 64-byte packet): `[0x55, command, 0, chk, size_or_len, offLo, offHi, 0, ...data]`, `chk = (sum of size_or_len, offLo, offHi, 0, ...data) & 0xFF` (assumes `b()` is lodash sum; verify on hardware). Device replies with first byte `0xAA` (expect=170). Max 56 data bytes per packet.

## Command model (PARTIAL)
Memory-style read/write: `command` + `offset` + `size`; reads chunk at 56 bytes per packet. Profiles are 1024-byte blocks (`offset = 1024*profile + ...`).
| Command | Dir | Meaning | Notes |
|---|---|---|---|
| 160 (0xA0) | get | key trigger table | offset `1024*profile + 8*keyIndex`, 8 bytes per key (whole profile = 1024) |
| 161 (0xA1) | set | all-key travel | offset `1024*profile`; per-key struct layout UNKNOWN |

## Features the SDK exposes (names only, UNKNOWN encoding)
Key matrix/remap (getKeyMatrix/getKeyInfos/setKeyConfigs), DKS, MT (mod-tap), TGL (toggle), advanced keys, RT (rapid trigger: getRtSeparateStruct, getRtMilliDigits), debounce, performance info, macros (independent macro headers/bytes), lighting (effect main/side, key colors, calibration RGB, music colors), GIF screen, profiles, EQ, sleep time, Mac mode, lock-Win-key, berserk mode, battery, RF/wireless info, firmware version.

## Still unknown (blocking writes)
- **checkCode algorithm** (not found yet; not in `parseInputBytes`, likely in base class `r.xT`).
- Meaning of `version`, `flags`, `bizCode` header bytes.
- 8-byte per-key trigger struct layout.
- Whether Ace 75 is PID 0x2201 or 0x2001.

## Key remap matrix (read-only, decoded 2026-11-18; writes NOT implemented)
- **Read:** cmd 8 = live matrix, cmd 7 = factory-default matrix (both added to the allowlist, read-only). Request offset = `512 * layerIndex`, length `3 * 128` = 384 bytes in 56-byte chunks (same Frame B as the other reads). `layerIndex = 4 * profile + layer`. The official write is cmd 9 (`setUserKeyMatrix`): NOT used, stays blocked until slice 5.
- **Layers (hub names, verified):** 0 = Win default, 1 = Win Fn, 2 = Mac default, 3 = Mac Fn. Layer indexes 4..7 (other profiles) returned the same data as 0..3 on this keyboard (all profiles share it or it is not per-profile; not investigated).
- **Entry:** 3 bytes `[type, code1, code2]`, row index = same matrix index as the trigger table (verified: all 81 named keys except FN1 and RT decode to their own name through this table on layer 0, see `test/matrix.test.js`).
  - `16` = keyboard key: `code2` = HID usage (4..29 = A..Z, 30..39 = 1..0, 58..69 = F1..F12, 82 = Up, ...), `code1` = modifier bitmask (1 LCtrl, 2 LShift, 4 LAlt, 8 Win/Cmd, 16 RCtrl, 32 RShift, 64 RAlt). A modifier key is `[16, mask, 0]`.
  - `48` = media: `code1` = consumer usage low byte: 226 Mute, 233 Vol+, 234 Vol-, 205 Play/Pause, 181 Next, 182 Prev, 111 Brightness+, 112 Brightness-.
  - `240` = special function: `[240, 255, n]` = FN key (n = 1 Win, 3 Mac); id 4 = switch to Win mode, 5 = switch to Mac mode; others (lighting and function icons on Fn+arrows, Esc, etc.) are not decoded.
  - `0` = unassigned. Rows 94..127 are filled with `240 + layer` bytes (unused sentinel).
  - Types 128 (seen in the official SDK code) and others did not appear on this keyboard in the default state.
- **Hub comparison (read-only, hub tab 按键配置):** Win default, Win Fn and Mac default layers: F1/F2 = brightness down/up, F5/F6 plain on Win Fn, F7..F12 = prev, play/pause, next, mute, vol-, vol+; O/P show the Win/Mac mode logos on Win Fn; Mac default shows Siri/screenshot on F5/F6 and Option/Cmd on the Alt/Win keys. All match the bytes. Layer 3 (Mac Fn) not viewed in the hub.
- Live matrix equals the factory matrix on all four layers (keyboard never remapped).

### Remap write (cmd 9), verified on hardware 2026-11-18
- **Write:** cmd 9, 3 data bytes `[type, code1, code2]` at offset `512 * layer + 3 * keyRow` (profile 0 only; the official code adds `profile * 512 * 4`, not tested). One key per request, same Frame B request as the other writes; the ack is not checksummed.
- **Test:** backup (including all 4 matrix layers), then Win Fn layer (1), key row 9 (Q): `16,0,20` -> `16,0,21` (R). Read-back of the whole layer showed only that key changed. The hub's Win Fn layer then showed R at the Q position and enabled its "restore all defaults" button. Restored with "factory default" (cmd 7 entry): all four layers read back equal to the factory matrix.
- **Safety rules in code:** only types 16 (keys, modifiers), 48 (known media codes) and 0 (none) are writable; type 240 (FN, Win/Mac mode switch, special functions) is refused so a wrong write cannot lock the user out of Fn.
- **Bug found and fixed while testing:** reading the four layers in parallel made replies cross (the reply parser matched on command only). Replies echo the request offset in bytes 5..6 (verified on reads); the parser now ignores a read reply whose offset differs. Write acks are not checked this way because their echo was not verified.
- **Not done:** restoring the matrix from a backup file (the backup stores `matrixHex`, 4 layers x 384 bytes, and import validates it, but there is no UI to write it back yet; per-key "factory default" is the restore path). Profiles other than 0, multi-key writes, and the special (240) entries are not implemented.

## Backlight (RGB), decoded and hardware-verified 2026-11-18
The lighting is in the same 64-byte settings block as the other settings (cmd 5 read, cmd 6 write, profile 0). Whole-block writes as before.
- **Main backlight (hub tab 背光灯):** byte 8 = effect id; byte 9 = brightness 0..100 (%); byte 10 = speed stored as `4 - level` (hub shows level 1..4, raw 0 = level 4); byte 11 = direction (0 = left to right for the horizontal wave, 1 = reverse); byte 12 = 1 means "use the effect's own colours", 0 = use the custom colour (the hub's colour-panel switch is on when byte 12 = 0); bytes 14..16 = custom colour R, G, B; byte 13 is preserved as read (colour index, meaning unknown).
- **Effect ids (hub names in brackets):** 1 rainbow cycle (七彩循环), 2 gradient (线性渐变), 3 steady (常亮), 4 breathing (呼吸), 5 disco (迪斯科), 6 horizontal wave (横向波浪), 7 vertical wave (纵向波浪), 8 center burst (中心扩散), 9 twinkling stars (星光闪烁), 10 center spiral (中心回旋), 11 rise and fall (底部升降), 12 bounce (往复回弹), 13 key ripple (按键涟漪), 14 steady ripple (常亮涟漪), 15 key afterglow (按键残影), 16 key fireworks (按键烟花), 17 key light column (按键光柱), 18 diagonal flow (斜向流光), 19 laser rain (激光雨), 20 sparkle (光点闪烁), 21 fireworks (烟花), 22 triangle bounce (三角回弹), 255 off (关闭). 0 is the custom per-key mode (hub's 自定义灯效 tab, not decoded) and 23 exists in the official data but is not in this keyboard's list. Which of speed, direction and colour apply to which effect comes from the official effect table.
- **Verified:** read: effect 6, level 4, 100%, left to right matched the hub exactly. Write via the app: Breathing, level 2, 50%, own colour #2060FF; read-back matched and the hub then showed 呼吸, 2档, 50%, colour switch on, HEX #2060FF. Restored; the whole block read back byte-for-byte identical to the original.
- **Byte 23 is the hub's "which light am I editing" tab, not part of the effect:** the official device data lists `lightOrder: ["main", "side2", "side"]` for the Ace 75 and the code stores the index of the selected tab in byte 23 (0 = backlight, 1 = ambient light 氛围灯 = "side2", 2 = LOGO light = "side"). It read 2 after my first lighting test because the hub had last been left on the LOGO tab. The app writes back whatever it read and does not compare it.
- **Not done:** LOGO light (bytes 24..31, hub tab LOGO灯: follow backlight / rainbow / breathing / steady / off) and ambient light (bytes 44..51, tab 氛围灯: follow backlight / flowing / rainbow / breathing / steady / off). Their effect values differ per model in the official data and were not matched to this keyboard, so they are not editable. On this keyboard both currently read effect 0 = "follow backlight". The per-key custom lighting (自定义灯效), calibration colour (bytes 40..42) and the master on/off switch are also untouched.

## Slice 7 findings (2026-11-18)
- **Debounce on-value = 7.** The official hub's debounce switch calls `setDebounce(profile, on ? 7 : 0)` (found in its code) and shows the switch on for any level >= 1. Verified: the app wrote level 7 (byte 7 bits 5-7), read-back matched, the hub's 按键防抖优化 (key debounce optimisation) switch showed ON; turning it off restored the block byte-for-byte. The app now offers an on/off switch (7 / 0) instead of a 0-7 slider; levels 1-6 are still shown as "on" if the keyboard has them.
- **Polling-rate write verified.** 8000 Hz -> 4000 Hz via the app: byte 4 low nibble 1 -> 2, read-back matched, the keyboard stayed connected (no USB re-enumeration, the page kept the device), the hub showed 4k selected. Back to 8000 Hz: whole block identical to the original. Raw values: 1k = 4, 2k = 3, 4k = 2, 8k = 1. 1000/2000 Hz not tried. Whether the host's actual polling interval changed was not measured, only the stored setting and the hub's view.
- **"Set press and release sensitivity separately" is NOT implemented, on purpose.** The official code stores that switch and the RT "milli digits" (finer-than-0.01 mm RT precision) in the keyboard's custom-parameter area, read and written with command 241 (0xF1) at an offset `profile * size + offset`, and falls back to the browser's local storage when the keyboard does not report support. Command 241 is not on the allowlist and its layout is unknown, so it was not touched. The app does not need it: every key already stores independent "press again after" (rtPress) and "let go after" (rtRelease) values in its trigger struct, and the app edits them separately. Unknown: whether the hub shows two separate values or one linked value for keys where they differ.

## Closing pass, 2026-11-18
- **Polling rate, all four values verified:** 1000 Hz (raw 4), 2000 Hz (raw 3), 4000 Hz (raw 2), 8000 Hz (raw 1) each written through the app and read back; no disconnect; back to 8000 Hz = whole block identical to the original. The earlier "1k/2k not tried" caveat is gone.
- **Remap with a media key and a modifier verified:** on the Windows + Fn layer, F5 -> Mute (`48,226,0`) and Z -> LShift (`16,2,0`) in one Apply; read-back matched, the neighbouring key was untouched; both reset with "Reset to factory"; layers 0 and 1 read back equal to the factory matrix and the saved fixtures.
- **Mac + Fn layer compared with the hub (layer 3):** plain F1..F12 (no media keys), Option and Cmd on the bottom row, the Win/Mac-mode and lighting icons at the same places as Win Fn; the hub's "restore all defaults" is greyed out (nothing remapped). Matches the bytes. All four layers are now hub-checked.
- **Firmware reply (cmd 3):** 31 bytes, checksum 0x28, body `18 01` + the ASCII build string `Jul 30 2026,17:07:58GL8KH-PRO`. Now a golden vector in `test/frame.test.js`. (An earlier note guessed "GLW8KH-PRO": wrong.)
- **(superseded, see "Logo light, ambient light and the master switch" below) LOGO light and ambient light:** what is known from the official device data: LOGO = "side" (bytes 24..31), ambient = "side2" (bytes 44..51); follow-the-backlight is effect value 0 for both; the LOGO "custom" value is 5, ambient has none. The value-to-effect table for the other options (rainbow, breathing, steady, flowing, off) is shared across models in the official code and which entries this keyboard uses could not be read out of it; the reliable way is to pick each option in the hub and read bytes 24 or 44 back, one option at a time. That needs the hub and the app to take turns holding the keyboard (the hub tab froze when I tried to keep both open), so it was left undone rather than guessed. Per-key custom lighting (自定义灯效) and the hub's master light switch ("close-all-light") are also untouched.
- **Not possible here:** a second real model (the 16K profile stays an unverified guess), the custom-parameter area (command 241, not allowlisted), screen-reader testing.

## Logo light, ambient light and the master switch (decoded 2026-11-18, hardware- and hub-verified)
Found by running the hub and the app side by side in two Chrome tabs (both can read the keyboard at the same time): click one hub option, read the settings block from the app, repeat. This corrects the earlier assumption (and the official data's names): **the hub's LOGO tab is bytes 44-51 and its ambient tab (氛围灯) is bytes 24-31.** The scope byte 23 follows the hub's selected tab: 0 backlight, 1 LOGO, 2 ambient.
- Both side lights use the same 8-byte layout, at offset +0: effect, +1 brightness 0-100, +2 speed stored as `4 - level` (level 1-4), +3 "use the effect's own colours" (1 = yes, so own colour on = 0), +4 untouched, +5..+7 colour R G B. There is no direction byte.
- **LOGO light (bytes 44-51):** 0 follow backlight, 1 rainbow cycle (speed, no colour), 2 breathing (speed, colour), 3 steady (colour). **Off = steady (3) with brightness 0**, not a value of its own.
- **Ambient light (bytes 24-31):** 0 follow backlight, 1 flowing (speed, colour), 2 rainbow cycle (speed), 3 breathing (speed, colour), 4 steady (colour). **Off = steady (4) with brightness 0.**
- **Master light switch (the hub's 灯光效果 switch):** off sets the three brightness bytes (9, 25, 45) to 0 and leaves every effect alone; on restores the previous brightnesses (the hub remembers them itself; the app keeps them in memory while the page is open, default 100).
- **Verified:** read each option from the hub; wrote LOGO breathing level 2, 50%, #2060FF and ambient flowing level 3, 70% through the app, read-back matched and a fresh hub session showed 呼吸 2档 50% #2060FF on the LOGO tab and 流光 3档 70% on the ambient tab; the "All lights" switch off/on read back correctly. All restored: the whole block is identical to the original.

## Per-key custom lighting: NOT supported (investigated and removed, 2026-11-18)
- The official code reads the stored key colours with command 10 (`getKeyCustomLight`, offset `512 * profile + start`) and writes one key with command 11 (`setSingleKeyColor`, offset `512 * profile + 3 * keyRow`, 3 bytes RGB). Both were temporarily allowlisted with the user's approval and tested on the keyboard.
- **Reads work:** 512 bytes, 3 per key, index = the key's matrix row (verified: the factory table is white on W, A, S, D and the four arrows, black everywhere else; this equals the hub's "default" custom preset).
- **Writes do not stick:** writing Esc = red and Q = green (and the backlight effect 0 = custom) read back correctly right away, but the keyboard did not light them (the user saw only the factory pattern), and after the effect was switched away and back the table read as the factory table again. So command 11 only fills a temporary editing buffer that the keyboard reloads from its saved table when the effect is selected. The official code keeps its saved custom presets in its own per-key light store (the hub's "30 static effects" list, kept through the custom-parameter area, command 241, and the hub's own storage) and there is a "select preset" label stored at custom-parameter offset 840. How the hub makes a painted preset permanent was not found.
- Decision: commands 10 and 11 were removed from the allowlist again and the feature was deleted from the app rather than shipping a control that says "saved" and then reverts. The keyboard's colour table was verified back to the factory pattern afterwards.

## Profiles, read-only spike S2 part 1 (2026-11-18, nothing written)
Read with cmd 5 at `64*t`, cmd 0xA0 at `1024*t`, cmd 8 at `512*(4*t+layer)`, t = 0..2, on the connected Ace 75 8K.
- **Settings and key tables are per profile.** Profiles 1 and 2 return different cmd 5 blocks and different key tables than profile 0 (e.g. block byte 1 is 0x00 / 0x04 / 0x09; key 0 head differs). So 3 stored profiles exist.
- **The remap matrix is NOT per profile on this keyboard**: all 4 layers of profiles 1 and 2 equal profile 0 (first 12 bytes compared per layer).
- NOT yet known: which profile is active and how it is switched (needs the hub: switch profile, diff the reads; cmd 14 `setBase` is only a candidate and is not allowlisted). Profiles 1/2 were not compared with the hub yet.

### Active profile (S2 part 2, 2026-11-18, VERIFIED with the hub)
- **cmd 4 (already allowlisted), offset 0, 56 bytes = the "base" block**: byte 0 = position of the active profile in the order list, byte 1 = number of profiles (3), bytes 2.. = order (0,1,2). Read: `0,3,0,1,2,3,170,187,...` Selecting "默认板载3" (default onboard 3) in the hub changed byte 0 to 2; selecting the first again restored 0.
- The hub switches profile by writing this block (official `setBase`: read cmd 4, change bytes 0..1+order, write back). The write command (probably cmd 4's set partner, not allowlisted) was NOT used by us.
- cmd 5 / 0xA0 reads at `64*t` / `1024*t` are indexed by profile number, so they did not change when the active profile changed (verified: identical before/after). Profile-view reading therefore needs no switching.
- Keyboard left on profile 0 (original).

### Profile switch write, cmd 14 (VERIFIED on hardware 2026-11-18, user approved adding it)
- Official `setBase` = `_simpleSendCommand(14, 0, data)`: data is the 56-byte base block as read with cmd 4, with byte 0 changed (position of the active profile in the order list). Our `writeActiveProfile` (src/write.js): gate, read cmd 4, validate (count == model.profiles, profile in the order list), change byte 0 only, one 56-byte cmd 14 write at offset 0, read cmd 4 back, compare all bytes.
- Test: app "Use Profile 2": backup saved, read-back OK, block `1,3,0,1,2,3,170,187,...` (only byte 0 changed); then "Use Profile 1": block `0,3,0,1,2,3,170,187,...` = original. Keyboard is back on Profile 1. Allowlist is now {3,4,5,6,7,8,9,14,0xA0,0xA1}.
- Not checked: that the keyboard visibly changed its lights/keys (the app's view of both profiles matched what was read, the live preview changed colour with the profile).

## S1 per-key colour persistence (2026-11-18, in progress; hub + app in two tabs, user approved)
- Baseline (cmd 10, offset 512*profile, 512 bytes): the table holds only the factory white keys (24 non-zero bytes at 3*row for 8 keys), identical for all 3 profiles.
- **Effect 0 = "custom / still" mode** (hub: 灯光设置 > 背光灯 > 自定义灯效 > 静态灯效 "默认"). Selecting it changed exactly one byte: settings block byte 8 (effect) 6 -> 0. The keyboard then shows the stored colour table.
- **The hub paints with cmd 11 into the cmd 10 table**: one click on Esc (brush #FF0000) changed `c0[93]` 0 -> 255 (Esc = key row 31, R byte at 3*31). Nothing else changed.
- **The table survives switching effect**: after choosing horizontal wave again (byte 8 back to 6) the red Esc was still in the cmd 10 table. (My earlier belief that the table is only a temporary buffer is therefore doubtful: the earlier "factory pattern only" observation needs re-checking.)
- cmd 10 is now allowlisted READ-ONLY (cmd 11 stays blocked). The hub also has "另存" (save as new static effect, up to 30, name list stored as JSON in the custom-parameter area, cmd 241) and "恢复默认" (restore default).
- **ANSWER: per-key colours persist in the keyboard's own memory.** After an unplug/replug the red Esc was still in the cmd 10 table (the only difference from the baseline), and the hub, reconnected, loaded it and drew Esc red in its custom-effect editor. No save step is needed for the table itself (the hub's "另存" only stores a named preset in the custom area, cmd 241, which we do not need).
- **To show the table on the keyboard the effect byte (settings block byte 8) must be 0.** Any other effect shows its own pattern and leaves the table untouched.
- Restored: the hub's 恢复默认 (restore default) put the factory colours back, horizontal wave re-selected; all three profiles' cmd 10 tables and cmd 5 blocks and the base block equal the baseline byte for byte (2026-11-18).
- Not verified: cmd 11 (the write) from OUR app; the hub did the writes. Whether the hub paints a whole table or single keys (single-key cmd 11 at offset `512*profile + 3*row` per the official code); the table is per profile only by offset (profiles 1/2 were identical to profile 0 at baseline).

### C1 per-key colours written by OUR app (VERIFIED on hardware 2026-11-18, user approved cmd 11)
- cmd 11 = write one key's colour: offset `512*profile + 3*row` (we only write profile 0), 3 data bytes [r,g,b]; ack is not checksummed (same as other writes). `writeColors` (src/write.js): gate, validate (row is a named key, 0-255 ints, all before the first write), one cmd 11 per painted key, then read the whole 512-byte table (cmd 10) and compare. Allowlist is now {3,4,5,6,7,8,9,10,11,14,0xA0,0xA1}.
- Apply order: colours first, then the settings block (so the table is in place when effect byte 8 becomes 0). Backups now carry `colorsHex` (profile 0, 512 bytes); import validates it and stages it.
- Test: app, Lighting, "Custom colors" (effect 0), painted Esc red, Apply: backup, one cmd 11, read-back OK; diff vs baseline was exactly `c0[93] 0->255` and `f0[8] 6->0`. The user confirmed on the real keyboard: Esc red, W A S D and arrows white, all other keys dark. Restored through the app (Esc repainted black, horizontal wave): all 3 profiles' cmd 10 tables, cmd 5 blocks and the base block equal the baseline byte for byte.
- Not tested: painting many keys at once, Fill all / Clear all on hardware, profiles 1/2 (view-only), restore-from-backup of colours on hardware (covered by the mock test).

### C1 follow-up hardware tests (2026-11-18, all restored)
- **Fill all keys** (83 named keys, red) + Apply: all 83 keys red in the cmd 10 table, effect byte 0, read-back OK. **Clear all keys** + Apply: table all zero, read-back OK (note this also removes the factory white W A S D and arrows).
- **Restore from a backup file** (taken automatically before the first Apply of that session, `colorsHex` = 24 non-zero bytes, effect 6): the app staged "8 painted keys + settings", Apply wrote them, read-back OK, and the keyboard then equalled the original baseline byte for byte (all 3 profiles' cmd 10 tables and cmd 5 blocks, base block).

### Limits seen on hardware (2026-11-18)
- The user set all 83 keys of profile 1 to **4.00 mm** in the official app; the keyboard stores it (trigger struct bytes 2-3 = `0x018F`, value + 1 = 400) and our app reads it back. So the press point range reaches at least 4.00 mm, more than the product page's "actuation 0.1-3.4 mm". The Ace 75 model therefore uses `actuation: [10, 400]`.
- Rapid Trigger press/release ranges: product page says 0.001-3.4 mm, the official device table says 3.4 mm for the default switch (some switches 3.0 or 3.5). Our limit is 3.40 mm (340 units); NOT tested on hardware.
- The official device table also lists per model `precisionConfig` (Ace 75: 0.01, 0.005 and 0.001 mm) and `featSupport` (LTEnabled, RTDoubleClick, lightCalibration, a second side light "hasSideEffect2"). The app only uses the 0.01 mm step.
- Product page (MCHOSE store): "Horizon RGB Light Bar ... synced with the keyboard backlight", three onboard profiles switched from the keyboard (RT button), volume knob on the left side with press to mute.
