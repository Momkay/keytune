// One-click starting points for key sensitivity. Distances are in 0.01 mm like everything else.
export const PRESETS = [
  { name: 'Factory feel', hint: '1.50 mm, Rapid Trigger off', patch: { actuation: 150, keyMode: 0, rtPress: 30, rtRelease: 30, pressDeadzone: 15, releaseDeadzone: 15 } },
  { name: 'Fast and responsive', hint: '1.00 mm, Rapid Trigger on', patch: { actuation: 100, keyMode: 1, rtPress: 20, rtRelease: 20, pressDeadzone: 15, releaseDeadzone: 15 } },
  { name: 'Comfortable typing', hint: '2.00 mm, Rapid Trigger off', patch: { actuation: 200, keyMode: 0, rtPress: 30, rtRelease: 30, pressDeadzone: 15, releaseDeadzone: 15 } },
];
