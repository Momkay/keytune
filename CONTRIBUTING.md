# Contributing

Thanks for helping. The most useful contribution is **verifying another keyboard model**: see `docs/ADDING_A_MODEL.md`. A model stays read-only until someone has tested it on real hardware.

- `npm ci`, then `npm test`, `npm run lint` and `npm run typecheck` must all pass.
- Protocol claims go in `PROTOCOL.md`, each marked as verified on hardware or not.
- Hardware tests change a real keyboard: take a backup first, restore afterwards and say so in the pull request.
- Start with `docs/DEVELOPING.md`. Safety rules (see `docs/internal/CONSTRAINTS.md`): only the transport module sends data, only allowlisted commands are sent, every write is validated, read back and compared. Never add firmware update, boot mode or reset commands.
- Please do not add code or files copied from the official MCHOSE app.
