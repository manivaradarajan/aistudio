// js/ui/content.js
import * as state from "../state.js";
import { buildPathFromNode } from "../utils.js";
import { openMobileOverlay } from "./mobile.js";
import { updateNavigatorState } from "./navigator.js";
import { updateArrowButtons } from "../app.js";

let dom;

export function initContent(domElements) {
  dom = domElements;
}

/**
 * Renders the main content items (mantras) for the current section.
 * @param {Array<object>} items - The array of item data to render.
 */
export function renderSectionItems(items) {
  if (!items || !Array.isArray(items)) {
    dom.mantraDisplay.innerHTML = "";
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    const container = document.createElement("div");
    container.className = "item-container";
    container.dataset.id = item.id;

    const numberEl = document.createElement("p");
    numberEl.className = "item-number";
    numberEl.textContent = item.number;

    const textEl = document.createElement("p");
    textEl.className = "item-text";
    textEl.textContent = item.text;

    container.appendChild(numberEl);
    container.appendChild(textEl);
    fragment.appendChild(container);
  });

  dom.mantraDisplay.innerHTML = "";
  dom.mantraDisplay.appendChild(fragment);
}

/**
 * Scrolls the main content display to the top.
 */
export function resetContentScroll() {
  if (dom && dom.mantraDisplay) {
    dom.mantraDisplay.scrollTop = 0;
  }
}

/**
 * Sets the main content title.
 * @param {string} title - The title to display.
 */
export function setContentTitle(title) {
  dom.contentTitle.textContent = title;
}

/**
 * Renders the commentary for a given data item.
 * @param {object} itemData - The data object for the selected item.
 */
export function renderCommentary(itemData) {
  dom.commentaryText.innerHTML = itemData.commentary_text
    ? marked.parse(itemData.commentary_text)
    : "<p>No commentary available.</p>";
}

/**
 * Clears any selected item and its commentary.
 * Used for mobile section navigation.
 */
export function clearSelection() {
  dom.mantraDisplay
    .querySelectorAll(".selected")
    .forEach((el) => el.classList.remove("selected"));
  renderCommentary({ commentary_text: "" }); // Clear commentary pane
}

/**
 * Selects an item: highlights it, updates state, and renders commentary.
 * This function does NOT handle scrolling.
 * @param {string} itemId - The unique ID of the item to select.
 */
export function selectItem(itemId) {
  // Clear previous selection
  dom.mantraDisplay
    .querySelectorAll(".selected")
    .forEach((el) => el.classList.remove("selected"));

  const itemContainer = dom.mantraDisplay.querySelector(
    `[data-id="${itemId}"]`
  );

  if (!itemContainer) {
    updateNavigatorState();
    updateArrowButtons();
    return;
  }

  itemContainer.classList.add("selected");

  const itemData = state.getNodeById(itemId);
  if (itemData) {
    renderCommentary(itemData);
    const newPath = buildPathFromNode(state.getCurrentTextSlug(), itemData);
    if (window.location.hash !== `#${newPath}`) {
      history.replaceState(null, "", `#${newPath}`);
    }
  }

  updateNavigatorState();
  updateArrowButtons();
}

/**
 * Selects an item AND scrolls it into the center of the view.
 * This is the central function for changing the "selected" state via direct interaction.
 * @param {string} itemId - The unique ID of the item to show.
 */
export function showItemDetails(itemId) {
  // First, perform all the state and rendering updates.
  selectItem(itemId);

  // Then, handle the view scrolling.
  const itemContainer = dom.mantraDisplay.querySelector(
    `[data-id="${itemId}"]`
  );
  if (itemContainer) {
    itemContainer.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // Finally, handle mobile-specific UI changes.
  const { userInitiatedClick } = state.getState();
  if (userInitiatedClick) {
    openMobileOverlay(dom.commentaryPane);
  }
}