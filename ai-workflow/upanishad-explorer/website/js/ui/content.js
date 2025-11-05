// js/ui/content.js

/**
 * @file This file manages the main content pane, including rendering items, handling selection, and displaying commentary.
 * @module content
 */

import * as state from "../state.js";
import { buildPathFromNode } from "../utils.js";
import { openMobileOverlay } from "./mobile.js";
import { updateNavigatorState } from "./navigator.js";
import { updateArrowButtons } from "./common.js";
import "../types.js"; // Import JSDoc type definitions

/**
 * A cached map of DOM elements used by the module.
 * @type {Object.<string, HTMLElement>}
 */
let dom;

/**
 * Initializes the content module with essential DOM elements.
 * @param {Object.<string, HTMLElement>} domElements - A map of cached DOM elements.
 */
export function initContent(domElements) {
  dom = domElements;
}

/**
 * Renders a list of items (e.g., mantras, verses) into the main content display.
 * @param {UpanishadNode[]} items - An array of item objects to render.
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
    numberEl.textContent = String(item.number);
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
 * Resets the scroll position of the main content display to the top.
 */
export function resetContentScroll() {
  if (dom && dom.mantraDisplay) {
    dom.mantraDisplay.scrollTop = 0;
  }
}

/**
 * Sets the title of the main content pane.
 * @param {string} title - The title to display.
 */
export function setContentTitle(title) {
  dom.contentTitle.textContent = title;
}

/**
 * Renders the commentary for a given item, processing custom reference links.
 * @param {UpanishadNode} itemData - The data object for the item, containing the commentary text.
 */
export function renderCommentary(itemData) {
  const rawMarkdown =
    itemData.commentary_text || "<p>No commentary available.</p>";
  const { showExternalRefs } = state.getState();

  //const refRegex = /\ \[([^\\]+)\]\(ref:([^\\]+)\)\/g;
  const refRegex = /\[([^\]]+)\]\(ref:([^\)]+)\)/g;

  const processedMarkdown = rawMarkdown.replace(
    refRegex,
    (match, displayText, refPath) => {
      const pathParts = refPath.split("/");
      const slugOrAlias = pathParts.shift();
      const remainingPath = pathParts.join("/");
      const libraryEntry = state.getTextFromLibrary(slugOrAlias);

      if (libraryEntry) {
        if (libraryEntry.isInternal) {
          const destinationPath = `/#/${libraryEntry.slug}/${remainingPath}`;
          const titleText = `${libraryEntry.name}\n${destinationPath}`;
          return `<a href="#" data-ref-slug="${libraryEntry.slug}" data-ref-path="${remainingPath}" class="commentary-ref internal-ref" title="${titleText}">${displayText}</a>`;
        } else {
          if (showExternalRefs) {
            const destinationPath = `(External) ${libraryEntry.slug}/${remainingPath}`;
            const titleText = `${libraryEntry.name}\n${destinationPath}`;
            return `<a href="#" data-ref-slug="${libraryEntry.slug}" data-ref-path="${remainingPath}" class="commentary-ref external-ref" title="${titleText}">${displayText}</a>`;
          } else {
            return `<span class="external-ref-disabled" title="${libraryEntry.name} (External reference disabled)">${displayText}</span>`;
          }
        }
      } else {
        return `<span class="invalid-ref" title="Unknown reference: ${slugOrAlias}">${displayText}</span>`;
      }
    }
  );

  dom.commentaryText.innerHTML = window.marked.parse(processedMarkdown);
}

/**
 * Clears the selection state in the main content display and the commentary pane.
 */
export function clearSelection() {
  dom.mantraDisplay
    .querySelectorAll(".selected")
    .forEach((el) => el.classList.remove("selected"));
  renderCommentary({ commentary_text: "" });
}

/**
 * Selects a specific item in the main content display by its ID.
 * @param {string} itemId - The ID of the item to select.
 */
export function selectItem(itemId) {
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
 * Shows the details of a specific item, including selecting it and scrolling it into view.
 * @param {string} itemId - The ID of the item to show.
 */
export function showItemDetails(itemId) {
  selectItem(itemId);
  const itemContainer = dom.mantraDisplay.querySelector(
    `[data-id="${itemId}"]`
  );
  if (itemContainer) {
    itemContainer.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const { userInitiatedClick } = state.getState();
  if (userInitiatedClick) {
    openMobileOverlay(dom.commentaryPane);
  }
}
