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

let touchStartY = 0;
let touchCurrentY = 0;
let isSwiping = false;

/**
 * Initializes the mobile UI module with essential DOM elements.
 * @param {Object.<string, HTMLElement>} domElements - A map of cached DOM elements.
 */
export function initMobileUI(domElements) {
  dom = domElements;
  dom.commentaryPane.addEventListener('touchstart', handleTouchStart, { passive: true });
  dom.commentaryPane.addEventListener('touchmove', handleTouchMove, { passive: true });
  dom.commentaryPane.addEventListener('touchend', handleTouchEnd, { passive: true });
  dom.commentaryPane.style.touchAction = 'none';
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
  dom.settingsPanel.classList.remove("active");
  dom.mobileOverlay.classList.remove("active");
  dom.body.classList.remove("mobile-overlay-active");
}

function handleTouchStart(e) {
  touchStartY = e.touches[0].clientY;
  isSwiping = true;
}

function handleTouchMove(e) {
  if (!isSwiping) return;
  touchCurrentY = e.touches[0].clientY;
  const deltaY = touchCurrentY - touchStartY;
  if (deltaY > 0) {
    dom.commentaryPane.style.transform = `translateY(${deltaY}px)`;
  }
}

function handleTouchEnd() {
  if (!isSwiping) return;
  isSwiping = false;
  const deltaY = touchCurrentY - touchStartY;
  if (deltaY > 100) { // Swipe down threshold
    closeMobileOverlays();
  }
  dom.commentaryPane.style.transform = '';
}
