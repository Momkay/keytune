// Write gate: no write unless the model is hardware-verified and a fresh backup was taken this session.
export function createWriteGate() {
  let backedUp = false;
  return {
    markBackedUp() { backedUp = true; },
    get backedUp() { return backedUp; },
    /** @param {{name: string, verified: boolean}} model */
    assertCanWrite(model) {
      if (!model.verified) throw new Error(`${model.name} is not hardware-verified: read-only`);
      if (!backedUp) throw new Error('download a backup before writing');
    },
  };
}
