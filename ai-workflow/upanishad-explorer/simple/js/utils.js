// js/utils.js

/**
 * @file This file contains utility functions that are used across the application.
 * @module utils
 */

import { CONFIG } from "./constants.js";
import "./types.js"; // Import JSDoc type definitions

/**
 * Caches DOM element references for efficient and repeated access.
 * It takes an object of selectors and returns an object with the corresponding DOM elements.
 * @param {DomSelectorMap} selectors - An object mapping keys to CSS selectors.
 * @returns {Object.<string, HTMLElement>} An object with the same keys mapped to the queried DOM elements.
 */
export function cacheDomElements(selectors) {
  const dom = {};
  for (const [key, selector] of Object.entries(selectors)) {
    if (key === "body") {
      // The body element is passed directly, not as a selector string.
      dom[key] = /** @type {HTMLElement} */ (selector);
    } else {
      dom[key] = document.querySelector(/** @type {string} */ (selector));
    }
  }
  return dom;
}

/**
 * Checks if the current viewport width is at or below the mobile breakpoint defined in the configuration.
 * @returns {boolean} True if the current view is considered mobile, false otherwise.
 */
export function isMobileView() {
  return window.innerWidth <= CONFIG.MOBILE_BREAKPOINT;
}

/**
 * Constructs a URL hash path for a given content node.
 * This path is used for routing and direct navigation.
 * @param {string} textSlug - The slug of the current text (e.g., "kena").
 * @param {UpanishadNode} node - The data node, which must have a `numberPath` property.
 * @returns {string} The full hash path (e.g., "/kena/1/2/5").
 */
export function buildPathFromNode(textSlug, node) {
  return `/${textSlug}/${node.numberPath.join("/")}`;
}
