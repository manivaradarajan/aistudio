// js/utils.js
import { CONFIG } from "./constants.js";

/**
 * Caches DOM element references.
 * @param {object} selectors - An object mapping keys to CSS selectors.
 * @returns {object} An object with the same keys mapped to DOM elements.
 */
export function cacheDomElements(selectors) {
  const dom = {};
  for (const [key, selector] of Object.entries(selectors)) {
    if (key === "body") {
      dom[key] = selector;
    } else {
      dom[key] = document.querySelector(selector);
    }
  }
  return dom;
}

/**
 * Checks if the current view is considered mobile.
 * @returns {boolean} True if window width is at or below the mobile breakpoint.
 */
export function isMobileView() {
  return window.innerWidth <= CONFIG.MOBILE_BREAKPOINT;
}

/**
 * Builds a URL hash path from a data node's metadata.
 * @param {string} textSlug - The slug for the current text.
 * @param {object} node - The data node containing a `numberPath`.
 * @returns {string} The full hash path, e.g., `#/slug/1/2/5`.
 */
export function buildPathFromNode(textSlug, node) {
  return `/${textSlug}/${node.numberPath.join("/")}`;
}
