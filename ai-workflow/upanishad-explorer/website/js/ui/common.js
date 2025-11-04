// js/ui/common.js
import * as state from "../state.js"; // Add this import

let dom; // To be initialized in app.js

/**
 * Initializes the common UI module with cached DOM elements.
 * @param {object} domElements - Cached DOM elements.
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
 * @param {Array<object>} allTexts - Array of text manifest objects.
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


// --- FUNCTION MOVED HERE ---
/**
 * Updates the enabled/disabled state of the previous/next arrow buttons
 * based on the current application state.
 */
export function updateArrowButtons() {
  if (!dom) return; // Guard against calls before initialization

  const { currentLocation, currentUpanishadData } = state.getState();
  if (!currentUpanishadData || !currentLocation) {
    dom.prevBtn.disabled = true;
    dom.nextBtn.disabled = true;
    return;
  }

  const topLevelSections = currentUpanishadData.content;
  const currentIndex = currentLocation.level0; // Assumes arrows navigate top-level sections

  if (topLevelSections.length <= 1) {
    dom.prevBtn.disabled = true;
    dom.nextBtn.disabled = true;
    return;
  }

  dom.prevBtn.disabled = currentIndex <= 0;
  dom.nextBtn.disabled = currentIndex >= topLevelSections.length - 1;
}