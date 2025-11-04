// js/ui/common.js

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
