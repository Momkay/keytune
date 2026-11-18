# Adding a keyboard model

This app only changes a keyboard once someone has proven, on a real keyboard of that model, that it works. Until then a model is **read-only**: you can look at its settings and save a backup, but the controls are switched off and the code refuses to write.

## If you own a keyboard that is not supported

1. Open the app in Chrome or Edge, plug the keyboard in by USB, close the official MCHOSE app, and press **Connect**.
2. Two things can happen:
   - **"... is not supported yet"**: press **Copy report** and paste it into a new issue. The report has the USB ids and nothing personal. Nothing was read from or written to the keyboard.
   - **The app opens with a yellow "not checked on real hardware yet" bar**: the model is known but unverified. Press **Copy report**, and use **Save backup** so you have a file. Share the report.
3. That is all you need to do. Do not try to write anything: the app will not let you, on purpose.

## If you want to add or verify a model (for developers)

Everything model-specific lives in one file, `src/models/<name>.js`, and one line in `src/models/index.js`.

1. **Identify it.** From the report: vendor id (always 0x3837 for MCHOSE so far) and product id. The official device table in the MCHOSE web app lists them; note the boot product id too, but never open it (`src/transport/discovery.js` refuses anything with a 0xFF00 interface).
2. **Create the profile** by copying `ace75-8k.js`. Set `name` (unique: backups are matched by name), `pid`, `verified: false`, and check each field:
   - `keymap`: `[matrix row, key name]` for every key. The row is the position in the keyboard's key table, not the physical order.
   - `layout`: the physical rows in key units, every row the same width.
   - `limits`: safe ranges for each trigger setting.
   - `keys`, `matrixKeys`, `lightEffects`: counts and the effect ids this model offers.
   Add it to `models` in `src/models/index.js`. The tests check that ids and names are unique and that the layout matches the key map.
3. **Read-only checks** (safe, nothing is written):
   - Does the connection read at all? A wrong "frame" (packet format) shows up as timeouts or "bad checksum" in the report. See `PROTOCOL.md` for the frame this app uses and the qhw alternative that is not implemented.
   - Compare the decoded values with what the official app shows for the same keyboard: key press points, Rapid Trigger, the settings, the remap layers, the lighting. Record each match (and each mismatch) in `PROTOCOL.md`.
4. **Write tests with real bytes** from that keyboard (see `test/fixtures` and `test/light.test.js` for the pattern).
5. **Hardware write test**, one feature at a time, following the project rules: save a backup, change one thing, read it back, check it in the official app, then restore and confirm the restore by reading the whole thing back. Write down what you did in `PROTOCOL.md`.
6. Only after steps 3 to 5 pass, set `verified: true` for the features that passed. If only some features were checked, say so in the model file and keep the rest disabled.

## Why it works this way

A wrong write to a keyboard is hard to undo and the author could only test one model. A read-only default makes adding a model safe for everyone: the worst a wrong profile can do is show wrong numbers.
