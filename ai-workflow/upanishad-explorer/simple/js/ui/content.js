// js/ui/content.js

/**
 * @file This file manages the main content pane, including rendering items, handling selection, and displaying commentary.
 * @module content
 */

import * as state from "../state.js";
import { getTransformedText } from "../data-processor.js";
import { diffStrings } from "../diff.js";
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

function processFootnotes(text, footnotes) {
  if (!footnotes || footnotes.length === 0) {
    return text;
  }

  let processedText = text;
  footnotes.forEach((footnote, index) => {
    const footnoteRef = `[${index + 1}]`;
    const footnoteLink = `<sup class="footnote-ref" data-footnote-id="${footnote.id}">${index + 1}</sup>`;
    processedText = processedText.replace(footnoteRef, footnoteLink);
  });

  return processedText;
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
  const { script, language, selectedVariants } = state.getState();
  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    const container = document.createElement("div");
    container.className = "item-container";
    container.dataset.id = item.id;
    const numberEl = document.createElement("p");
    numberEl.className = "item-number";
    numberEl.textContent = String(item.number);
    container.appendChild(numberEl);

    const selectedVariant = selectedVariants[item.id];

    if (language === 'sanskrit' || language === 'both') {
      const canonicalText = getTransformedText(item.content, script);
      let textToRender = canonicalText;

      if (selectedVariant && selectedVariant !== 'canonical') {
        const variantText = getTransformedText(item.variants[selectedVariant], script);
        textToRender = diffStrings(canonicalText, variantText);
      } else {
        textToRender = processFootnotes(textToRender, item.footnotes);
      }

      const textEl = document.createElement("p");
      textEl.className = "item-text sanskrit-text";
      textEl.innerHTML = textToRender;
      textEl.lang = script === 'devanagari' ? 'hi' : 'en';
      container.appendChild(textEl);
    }

    if (language === 'english' || language === 'both') {
      let englishText = item.content?.english_translation || '';
      englishText = processFootnotes(englishText, item.footnotes);
      const textEl = document.createElement("p");
      textEl.className = "item-text english-text";
      textEl.innerHTML = englishText;
      textEl.lang = 'en';
      container.appendChild(textEl);
    }

    if (item.variants) {
      const variantBadge = document.createElement('span');
      variantBadge.className = 'variant-badge';
      variantBadge.textContent = 'ⓘ';
      variantBadge.dataset.itemId = item.id;
      container.appendChild(variantBadge);
    }

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
  const { script, language, showExternalRefs, selectedCommentaries } = state.getState();
  let allCommentariesMarkdown = "";

  if (!itemData.commentaries || itemData.commentaries.length === 0) {
    dom.commentaryText.innerHTML = "<p>No commentary available.</p>";
    return;
  }

  selectedCommentaries.forEach(commentaryId => {
    const commentary = itemData.commentaries.find(c => c.commentary_id === commentaryId);
    if (!commentary) return;

    let combinedMarkdown = `<h3>${commentary.commentator}</h3>`;

    if (language === 'sanskrit' || language === 'both') {
      const sanskritCommentary = getTransformedText(commentary, script);
      if (sanskritCommentary) {
        combinedMarkdown += sanskritCommentary + '\n\n';
      }
    }

    if (language === 'english' || language === 'both') {
      const englishCommentary = commentary.english_translation || '';
      if (englishCommentary) {
        combinedMarkdown += englishCommentary;
      }
    }

    allCommentariesMarkdown += combinedMarkdown + '<hr>';
  });

  if (!allCommentariesMarkdown) {
    dom.commentaryText.innerHTML = "<p>No commentary available for the selected language(s) and commentator(s).</p>";
    return;
  }

  allCommentariesMarkdown = processFootnotes(allCommentariesMarkdown, itemData.footnotes);

  const refRegex = /\\[([^\\]+)\\]\\(ref:([^\)]+)\\)/g;

  const processedMarkdown = allCommentariesMarkdown.replace(
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
          return `<a href=\"#\" data-ref-slug=\" ${libraryEntry.slug}\" data-ref-path=\" ${remainingPath}\" class=\"commentary-ref internal-ref\" title=\" ${titleText}\">${displayText}</a>`;
        } else {
          if (showExternalRefs) {
            const destinationPath = `(External) ${libraryEntry.slug}/${remainingPath}`;
            const titleText = `${libraryEntry.name}\n${destinationPath}`;
            return `<a href=\"#\" data-ref-slug=\" ${libraryEntry.slug}\" data-ref-path=\" ${remainingPath}\" class=\"commentary-ref external-ref\" title=\" ${titleText}\">${displayText}</a>`;
          } else {
            return `<span class=\"external-ref-disabled\" title=\" ${libraryEntry.name} (External reference disabled)\">${displayText}</span>`;
          }
        }
      } else {
        return `<span class=\"invalid-ref\" title=\"Unknown reference: ${slugOrAlias}\">${displayText}</span>`;
      }
    }
  );

  dom.commentaryText.innerHTML = window.marked.parse(processedMarkdown);
}

export function showTooltip(target, content) {
  const tooltip = dom.tooltip;
  tooltip.innerHTML = content;
  tooltip.classList.add('active');

  const targetRect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();

  let top = targetRect.bottom + window.scrollY + 5;
  let left = targetRect.left + window.scrollX - tooltipRect.width / 2 + targetRect.width / 2;

  if (top + tooltipRect.height > window.innerHeight) {
    top = targetRect.top + window.scrollY - tooltipRect.height - 5;
  }

  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
}

export function hideTooltip() {
  dom.tooltip.classList.remove('active');
}

/**
 * Clears the selection state in the main content display and the commentary pane.
 */
export function clearSelection() {
  dom.mantraDisplay
    .querySelectorAll(".selected")
    .forEach((el) => el.classList.remove("selected"));
  renderCommentary({ commentaries: [] });
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

export function openVariantModal(itemData) {
  const { variants } = itemData;
  const { selectedVariants } = state.getState();
  const currentVariant = selectedVariants[itemData.id] || 'canonical';

  dom.variantModalBody.innerHTML = '';
  const form = document.createElement('form');

  const canonicalInput = createVariantInput('canonical', 'Canonical', currentVariant, itemData.id);
  form.appendChild(canonicalInput);

  for (const variantName in variants) {
    if (variantName !== 'canonical') {
      const input = createVariantInput(variantName, variantName, currentVariant, itemData.id);
      form.appendChild(input);
    }
  }

  dom.variantModalBody.appendChild(form);
  dom.variantModal.style.display = 'block';
}

function createVariantInput(name, label, currentVariant, itemId) {
  const container = document.createElement('div');
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = 'variant';
  input.value = name;
  input.id = `variant-${name}`;
  input.checked = name === currentVariant;
  input.dataset.itemId = itemId;

  const labelEl = document.createElement('label');
  labelEl.htmlFor = `variant-${name}`;
  labelEl.textContent = label;

  container.appendChild(input);
  container.appendChild(labelEl);
  return container;
}