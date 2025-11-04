// js/ui/mobile.js

let dom; // To be initialized in app.js

/**
 * Initializes the mobile UI module with cached DOM elements.
 * @param {object} domElements - Cached DOM elements.
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
