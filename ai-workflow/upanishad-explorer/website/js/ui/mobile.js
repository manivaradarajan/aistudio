// js/ui/mobile.js

/**
 * @file This file manages the user interface for the mobile view, specifically the overlay panes for navigation and commentary.
 * @module mobile
 */

/**
 * A cached map of DOM elements used by the module.
 * @type {Object.<string, HTMLElement>}
 */
let dom;

/**
 * Initializes the mobile UI module with essential DOM elements.
 * @param {Object.<string, HTMLElement>} domElements - A map of cached DOM elements.
 */
export function initMobileUI(domElements) {
  dom = domElements;
}

/**
 * Opens a mobile overlay pane (navigator or commentary).
 * @param {HTMLElement} pane - The pane element to activate.
 */
export function openMobileOverlay(pane) {
  pane.classList.add("active");
  dom.mobileOverlay.classList.add("active");
  dom.body.classList.add("mobile-overlay-active");
}

/**
 * Closes all active mobile overlay panes.
 */
export function closeMobileOverlays() {
  dom.navigatorPane.classList.remove("active");
  dom.commentaryPane.classList.remove("active");
  dom.mobileOverlay.classList.remove("active");
  dom.body.classList.remove("mobile-overlay-active");
}
