// Ace 75 8K. Verified on hardware (see PROTOCOL.md); unverified models must stay read-only.
export const ace75_8k = {
  name: 'Ace 75 8K',
  verified: true,
  vid: 0x3837,
  pid: 0x303C,
  keys: 128,
  lightBar: true, // the thin light bar under the function row (follows the ambient light)
  profiles: 3, // onboard profiles (hub: 默认板载 1-3); settings at 64*n, keys at 1024*n
  matrixKeys: 128, // 3-byte entries per layer in the key matrix (cmd 7/8)
  // field -> [min, max]. shortcut: conservative guesses, the hub's real limits were not read; widen once checked
  limits: /** @type {Record<string, [number, number]>} */ ({ keyMode: [0, 2], actuation: [10, 400], rtPress: [1, 200], rtRelease: [1, 200], pressDeadzone: [0, 100], releaseDeadzone: [0, 100] }),
  // Physical layout, in key units (1u = one standard key): a string is a 1u key, [name, width] a wider key, a number is a gap,
  // and '@logo' is the logo key at the right end of the shift row (the logo light).
  // Every row is 16u wide. Mute and the RT key are not on the main board; they are shown as extras.
  layout: /** @type {(string | number | [string, number])[][]} */ ([
    ['Esc', 0.25, 'F1', 'F2', 'F3', 'F4', 0.25, 'F5', 'F6', 'F7', 'F8', 0.25, 'F9', 'F10', 'F11', 'F12', 0.25, 'Delete', 'Home'],
    ['~', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', ['Bksp', 2], 'End'],
    [['Tab', 1.5], 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', ['\\', 1.5], 'PgUp'],
    [['Caps', 1.75], 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", ['Enter', 2.25], 'PgDn'],
    [['LShift', 2.25], 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', ['RShift', 1.75], 'Up', '@logo'],
    [['LCtrl', 1.25], ['Win', 1.25], ['LAlt', 1.25], ['Space', 6.25], 'FN1', 'RCtrl', 1, 'Left', 'Down', 'Right'],
  ]),
  extras: ['Mute', 'RT'],
  // Backlight effects (settings block byte 8), in the hub's order. speed/dir/color say which controls the effect uses.
  // Names are English renderings of the hub's Chinese names; ids and capabilities come from the official data and the hub list.
  lightEffects: [
    { id: 0, name: 'Custom colors', short: 'Custom', group: 'Custom', speed: false, dir: false, color: false }, // shows the stored per-key colour table (PROTOCOL.md S1)
    { id: 6, name: 'Horizontal wave', short: 'Horiz. wave', group: 'Motion', speed: true, dir: true, color: true },
    { id: 7, name: 'Vertical wave', short: 'Vert. wave', group: 'Motion', speed: true, dir: true, color: true },
    { id: 8, name: 'Center burst', group: 'Motion', speed: true, dir: true, color: true },
    { id: 10, name: 'Center spiral', group: 'Motion', speed: true, dir: true, color: true },
    { id: 11, name: 'Rise and fall', group: 'Motion', speed: true, dir: false, color: true },
    { id: 12, name: 'Bounce', group: 'Motion', speed: true, dir: false, color: true },
    { id: 18, name: 'Diagonal flow', group: 'Motion', speed: true, dir: false, color: true },
    { id: 22, name: 'Triangle bounce', group: 'Motion', speed: true, dir: false, color: true },
    { id: 1, name: 'Rainbow cycle', group: 'Colors', speed: true, dir: false, color: false },
    { id: 5, name: 'Disco', group: 'Colors', speed: true, dir: false, color: false },
    { id: 2, name: 'Gradient', group: 'Colors', speed: false, dir: false, color: true },
    { id: 3, name: 'Steady', group: 'Colors', speed: false, dir: false, color: true },
    { id: 4, name: 'Breathing', group: 'Colors', speed: true, dir: false, color: true },
    { id: 9, name: 'Twinkling stars', group: 'Sparkle', speed: true, dir: false, color: true },
    { id: 20, name: 'Sparkle', group: 'Sparkle', speed: true, dir: false, color: true },
    { id: 19, name: 'Laser rain', group: 'Sparkle', speed: true, dir: false, color: true },
    { id: 21, name: 'Fireworks', group: 'Sparkle', speed: true, dir: false, color: true },
    { id: 13, name: 'Key ripple', group: 'Reacts to typing', speed: true, dir: false, color: true },
    { id: 14, name: 'Steady ripple', group: 'Reacts to typing', speed: true, dir: false, color: true },
    { id: 15, name: 'Key afterglow', group: 'Reacts to typing', speed: true, dir: false, color: true },
    { id: 16, name: 'Key fireworks', group: 'Reacts to typing', speed: true, dir: false, color: true },
    { id: 17, name: 'Key light column', short: 'Light column', group: 'Reacts to typing', speed: true, dir: false, color: true },
    { id: 255, name: 'Off', group: 'Off', speed: false, dir: false, color: false },
  ],
  // Logo and ambient lights (settings block bytes 44-51 and 24-31). Values read from the keyboard while picking each option in the hub.
  // "Off" is the steady effect with brightness 0, not a value of its own. speed/color say which controls an effect uses.
  sideLights: [
    { key: 'logo', name: 'Logo light', follow: 0, off: 3, effects: [
      { value: 1, name: 'Rainbow cycle', speed: true, color: false },
      { value: 2, name: 'Breathing', speed: true, color: true },
      { value: 3, name: 'Steady', speed: false, color: true },
    ] },
    { key: 'ambient', name: 'Ambient light', follow: 0, off: 4, effects: [
      { value: 1, name: 'Flowing', speed: true, color: true },
      { value: 2, name: 'Rainbow cycle', speed: true, color: false },
      { value: 3, name: 'Breathing', speed: true, color: true },
      { value: 4, name: 'Steady', speed: false, color: true },
    ] },
  ],
  // [trigger-table row, key name] in physical keyboard order. Row index = matrix position (hub-verified for 79 keys)
  keymap: /** @type {[number, string][]} */ (
    [[31,"Esc"],[77,"F1"],[33,"F2"],[78,"F3"],[58,"F4"],[36,"F5"],[41,"F6"],[21,"F7"],[27,"F8"],[71,"F9"],[7,"F10"],[26,"F11"],[6,"F12"],[8,"Delete"],[69,"Home"],[75,"~"],[11,"1"],[55,"2"],[34,"3"],[14,"4"],[80,"5"],[85,"6"],[87,"7"],[49,"8"],[51,"9"],[73,"0"],[70,"-"],[28,"="],[50,"Bksp"],[67,"End"],[53,"Tab"],[9,"Q"],[90,"W"],[56,"E"],[63,"R"],[19,"T"],[65,"Y"],[43,"U"],[5,"I"],[29,"O"],[48,"P"],[4,"["],[45,"]"],[1,"\\"],[74,"PgUp"],[18,"Caps"],[88,"A"],[89,"S"],[91,"D"],[35,"F"],[57,"G"],[81,"H"],[15,"J"],[83,"K"],[39,"L"],[44,";"],[0,"'"],[46,"Enter"],[30,"PgDn"],[62,"LShift"],[86,"Z"],[82,"X"],[16,"C"],[79,"V"],[37,"B"],[59,"N"],[17,"M"],[61,","],[66,"."],[2,"/"],[24,"RShift"],[10,"Up"],[40,"LCtrl"],[84,"Win"],[20,"LAlt"],[13,"Space"],[22,"FN1"],[52,"RCtrl"],[68,"Left"],[32,"Down"],[54,"Right"],[92,"Mute"],[93,"RT"]]
  ),
};
