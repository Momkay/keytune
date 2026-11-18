// The icon set: simple 24x24 stroke icons drawn for this app (no library, no MCHOSE artwork).
const NS = 'http://www.w3.org/2000/svg';

/** @type {Record<string, string>} */
export const ICONS = {
  trigger: 'M12 4v12M8 12l4 4 4-4M5 20h14',
  keys: 'M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
  light: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  sliders: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M8 15v4',
  download: 'M12 4v11M8 11l4 4 4-4M5 20h14',
  upload: 'M12 15V4M8 8l4-4 4 4M5 20h14',
  layers: 'M12 4l8 4-8 4-8-4 8-4zM4 12l8 4 8-4M4 16l8 4 8-4',
  check: 'M5 12l4 4 10-10',
  undo: 'M9 7H5V3M5 7a8 8 0 1 1-1 7',
  alert: 'M12 8v5M12 16.5v.01M10.3 4.6L3 18a2 2 0 0 0 1.7 3h14.6A2 2 0 0 0 21 18L13.7 4.6a2 2 0 0 0-3.4 0z',
  chevron: 'M9 6l6 6-6 6',
  plug: 'M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0V8zM12 16v5',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3',
  close: 'M6 6l12 12M18 6L6 18',
  power: 'M12 3v8M6.4 7a8 8 0 1 0 11.2 0',
  info: 'M12 11v5M12 8v.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  plus: 'M12 5v14M5 12h14',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z',
};

/** An inline SVG icon. @param {string} name a key of ICONS @param {number} [size] pixels */
export function icon(name, size = 20) {
  const d = ICONS[name];
  if (!d) throw new Error(`unknown icon ${name}`);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size)); svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.75'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', d);
  svg.append(path);
  svg.classList.add('icon');
  return svg;
}

/** The app logo: a keycap, a rounded key outline with a thick bottom lip. Not tied to any model or brand. Same shape as logo.svg (the favicon). @param {number} [size] height in pixels */
export function logo(size = 20) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('height', String(size)); svg.setAttribute('width', String(size));
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', LOGO); path.setAttribute('fill-rule', 'evenodd');
  svg.append(path);
  svg.classList.add('icon');
  return svg;
}

const LOGO = 'M28 10H72A18 18 0 0 1 90 28V72A18 18 0 0 1 72 90H28A18 18 0 0 1 10 72V28A18 18 0 0 1 28 10ZM36 24H64A10 10 0 0 1 74 34V54A10 10 0 0 1 64 64H36A10 10 0 0 1 26 54V34A10 10 0 0 1 36 24Z';
