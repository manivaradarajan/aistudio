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
 * Highlights a specific item in the main view and displays its details.
 * This is the central function for changing the "selected" state.
 * It is now responsible for triggering UI updates that depend on this state.
 * @param {string} itemId - The unique ID of the item to show.
 */
export function showItemDetails(itemId) {
  const { userInitiatedClick } = state.getState();
  const itemContainer = dom.mantraDisplay.querySelector(
    `[data-id="${itemId}"]`
  );
  if (!itemContainer) return;

  // FIX: Use querySelectorAll to robustly clear any existing selected items.
  dom.mantraDisplay
    .querySelectorAll(".selected")
    .forEach((el) => el.classList.remove("selected"));

  itemContainer.classList.add("selected");
  itemContainer.scrollIntoView({ behavior: "smooth", block: "center" });

  const itemData = state.getNodeById(itemId);
  if (itemData) {
    renderCommentary(itemData);
    const newPath = buildPathFromNode(state.getCurrentTextSlug(), itemData);
    if (window.location.hash !== `#${newPath}`) {
      history.replaceState(null, "", `#${newPath}`);
    }
  }

  // Trigger navigator and arrow updates AFTER the item is selected.
  // This ensures they can correctly read the state from the DOM.
  updateNavigatorState();
  updateArrowButtons();

  if (userInitiatedClick) {
    openMobileOverlay(dom.commentaryPane);
  }
}
