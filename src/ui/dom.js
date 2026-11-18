// Tiny element builder. Text goes in as text nodes, never as markup, so no value can inject HTML.
/** @typedef {any} Ctx shared app state, see app.js */

/**
 * @param {string} tag
 * @param {Record<string, any>} [props] class, style (object of CSS variables), onXxx handlers, anything else is set as a property or attribute
 * @param {...any} kids strings, elements or arrays of them
 * @returns {any}
 */
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || (v === false && !k.startsWith('aria-'))) continue; // aria-pressed="false" must still be written
    if (k === 'class') el.className = v;
    else if (k === 'style') for (const [p, val] of Object.entries(v)) el.style.setProperty(p, String(val));
    else if (k === 'for') /** @type {any} */ (el).htmlFor = v; // a plain el.for = ... does nothing, which left every label unlinked
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k.startsWith('aria-') || k.startsWith('data-') || k === 'role') el.setAttribute(k, v === true ? 'true' : String(v));
    else /** @type {any} */ (el)[k] = v;
  }
  el.append(...kids.flat(Infinity).filter(c => c != null && c !== false));
  return el;
}

/** Replace all children of `el`. @param {any} el @param {...any} kids */
export function fill(el, ...kids) {
  el.replaceChildren(...kids.flat(Infinity).filter(c => c != null && c !== false));
}
