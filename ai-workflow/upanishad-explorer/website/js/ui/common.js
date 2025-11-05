// js/ui/common.js

/**
 * @file This file contains common UI utility functions that are used across different modules.
 * @module common
 */

import * as state from "../state.js";
import "../types.js"; // Import JSDoc type definitions

/**
 * A cached map of DOM elements used by the module.
 * @type {Object.<string, HTMLElement>}
 */
let dom;

/**
 * Initializes the common UI module with essential DOM elements.
 * @param {Object.<string, HTMLElement>} domElements - A map of cached DOM elements from the main application file.
 */
export function initCommonUI(domElements) {
  dom = domElements;
}

/**
 * Displays a generic error message in the main content area.
 * @param {string} message - The error message to display.
 */
export function showError(message) {
  dom.contentTitle.textContent = "Error";
  dom.mantraDisplay.innerHTML = `<p style="padding: 2rem; text-align: center; color: var(--text-color-muted);">${message}</p>`;
  dom.commentaryText.innerHTML = "";
}

/**
 * Displays a loading message in the main content area.
 * @param {string} [message="Loading..."] - The loading message to display.
 */
export function showLoading(message = "Loading...") {
  dom.mantraDisplay.innerHTML = `<p style="padding: 2rem; text-align: center; color: var(--text-color-muted);">${message}</p>`;
}

/**
 * Populates the main text selector dropdown.
 * @param {LibraryEntry[]} allTexts - Array of text manifest objects.
 */
export function populateTextSelector(allTexts) {
  dom.textSelector.innerHTML = "";
  allTexts.forEach((text) => {
    const option = document.createElement("option");
    option.value = text.slug;
    option.textContent = text.name;
    dom.textSelector.appendChild(option);
  });
}

/**
 * Updates the enabled/disabled state of the previous/next arrow buttons
 * based on the current application state.
 */
export function updateArrowButtons() {
  if (!dom) return;

  const { currentLocation, currentUpanishadData } = state.getState();
  if (!currentUpanishadData || !currentLocation) {
    /** @type {HTMLButtonElement} */ (dom.prevBtn).disabled = true;
    /** @type {HTMLButtonElement} */ (dom.nextBtn).disabled = true;
    return;
  }

  const topLevelSections = currentUpanishadData.content;
  const currentIndex = currentLocation.level0;

  if (topLevelSections.length <= 1) {
    /** @type {HTMLButtonElement} */ (dom.prevBtn).disabled = true;
    /** @type {HTMLButtonElement} */ (dom.nextBtn).disabled = true;
    return;
  }

  /** @type {HTMLButtonElement} */ (dom.prevBtn).disabled = currentIndex <= 0;
  /** @type {HTMLButtonElement} */ (dom.nextBtn).disabled = currentIndex >= topLevelSections.length - 1;
}