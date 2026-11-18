// Messages at the bottom of the screen, and handing a file to the user.
import { h, fill } from './dom.js';

/** @param {any} host element that stays in the page (aria-live) */
export function createToaster(host) {
  /** @type {any} */
  let timer = 0;
  // Hidden elements are not announced, so messages are also written into two always-present live regions.
  const polite = h('div', { class: 'sr-only', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const assertive = h('div', { class: 'sr-only', 'aria-live': 'assertive', 'aria-atomic': 'true' });
  return {
    regions: [polite, assertive],
    /** @param {string} text @param {'info' | 'ok' | 'error'} [kind] errors stay until dismissed */
    show(text, kind = 'info') {
      clearTimeout(timer);
      host.className = 'toast ' + kind;
      const live = kind === 'error' ? assertive : polite;
      live.textContent = '';
      setTimeout(() => { live.textContent = text; }, 50); // clear-then-set so a repeated message is announced again
      fill(host, h('span', {}, text), kind === 'error' && h('button', { type: 'button', class: 'btn ghost', onclick: () => this.hide() }, 'Dismiss'));
      host.hidden = false;
      if (kind === 'ok') timer = setTimeout(() => this.hide(), 6000);
    },
    hide() { host.hidden = true; },
  };
}

/** Offer a text file as a download. @param {string} name @param {string} text */
export function saveFile(name, text) {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
