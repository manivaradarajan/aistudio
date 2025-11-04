// js/ui/content.js
import * as state from "../state.js";
import { buildPathFromNode } from "../utils.js";
import { openMobileOverlay } from "./mobile.js";
import { updateNavigatorState } from "./navigator.js";
// --- FIX IS HERE: Changed import path ---
import { updateArrowButtons } from "./common.js";

let dom;

export function initContent(domElements) {
  dom = domElements;
}

// ... (renderSectionItems, resetContentScroll, setContentTitle remain the same) ...
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
export function resetContentScroll() {
  if (dom && dom.mantraDisplay) {
    dom.mantraDisplay.scrollTop = 0;
  }
}
export function setContentTitle(title) {
  dom.contentTitle.textContent = title;
}


// --- MODIFIED FUNCTION ---
/**
 * Renders the commentary for a given data item, parsing custom `ref:` links.
 * @param {object} itemData - The data object for the selected item.
 */
export function renderCommentary(itemData) {
  const rawMarkdown = itemData.commentary_text || "<p>No commentary available.</p>";

  // Regex to find all custom reference links: [Display Text](ref:slug/path)
  const refRegex = /\[([^\]]+)\]\(ref:([^\)]+)\)/g;

  const processedMarkdown = rawMarkdown.replace(refRegex, (match, displayText, refPath) => {
    const pathParts = refPath.split('/');
    const slugOrAlias = pathParts.shift();
    const remainingPath = pathParts.join('/');

    const libraryEntry = state.getTextFromLibrary(slugOrAlias);

    if (libraryEntry) {
      // Create a clickable <a> tag with data attributes for the click handler
      return `<a href="#"
                 data-ref-slug="${libraryEntry.slug}"
                 data-ref-path="${remainingPath}"
                 class="commentary-ref ${libraryEntry.isInternal ? 'internal-ref' : 'external-ref'}"
                 title="Reference to: ${libraryEntry.name}">${displayText}</a>`;
    } else {
      // If the slug is not found in the library, render it as a non-clickable span
      return `<span class="invalid-ref" title="Unknown reference: ${slugOrAlias}">${displayText}</span>`;
    }
  });

  dom.commentaryText.innerHTML = marked.parse(processedMarkdown);
}


// ... (clearSelection, selectItem, showItemDetails remain the same) ...
export function clearSelection() {
  dom.mantraDisplay
    .querySelectorAll(".selected")
    .forEach((el) => el.classList.remove("selected"));
  renderCommentary({ commentary_text: "" });
}
export function selectItem(itemId) {
  dom.mantraDisplay
    .querySelectorAll(".selected")
    .forEach((el) => el.classList.remove("selected"));
  const itemContainer = dom.mantraDisplay.querySelector(`[data-id="${itemId}"]`);
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
export function showItemDetails(itemId) {
  selectItem(itemId);
  const itemContainer = dom.mantraDisplay.querySelector(`[data-id="${itemId}"]`);
  if (itemContainer) {
    itemContainer.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  const { userInitiatedClick } = state.getState();
  if (userInitiatedClick) {
    openMobileOverlay(dom.commentaryPane);
  }
}