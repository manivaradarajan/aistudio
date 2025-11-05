// js/events.js

/**
 * @file This file contains all the event handler functions for the application.
 * @module events
 */

import * as state from "./state.js";
import * as contentUI from "./ui/content.js";
import { navigateTo } from "./router.js";
import { isMobileView } from "./utils.js";
import { closeMobileOverlays } from "./ui/mobile.js";
import { DOM_SELECTORS } from "./constants.js";

/**
 * Handles the change event on the main text selector dropdown.
 * @param {Event} e - The change event object.
 */
export function handleTextChange(e) { navigateTo(`/${/** @type {HTMLSelectElement} */ (e.target).value}`); }

/**
 * Handles the change event on the toggle for external references.
 * @param {Event} e - The change event object.
 */
export function handleRefToggleChange(e) {
  const shouldShow = /** @type {HTMLInputElement} */ (e.target).checked;
  state.updateState({ showExternalRefs: shouldShow });
  const selectedItem = /** @type {HTMLElement} */ (document.querySelector(".selected"));
  if (selectedItem) {
    const itemId = selectedItem.dataset.id;
    const itemData = state.getNodeById(itemId);
    if (itemData) {
      contentUI.renderCommentary(itemData);
    }
  }
}

/**
 * Closes the mobile navigation overlay when a link inside it is clicked.
 * @param {Event} e - The click event object.
 */
export function handleNavigatorClick(e) { if (/** @type {HTMLElement} */ (e.target).closest("a")) { closeMobileOverlays(); } }

/**
 * Handles clicks on individual items in the main content pane.
 * @param {Event} e - The click event object.
 */
export function handleMantraClick(e) {
  const container = /** @type {HTMLElement} */ (e.target).closest(DOM_SELECTORS.itemContainer);
  if (!container) return;

  const itemId = container.dataset.id;
  const itemData = state.getNodeById(itemId);
  if (!itemData) return;

  const { numberPath } = itemData;
  const newPath = `/${state.getCurrentTextSlug()}/${numberPath.join("/")}`;
  const newHash = `#${newPath}`;

  state.updateState({ userInitiatedClick: true });

  if (window.location.hash === newHash && isMobileView()) {
    contentUI.showItemDetails(itemId);
  } else {
    navigateTo(newPath);
  }
}

/**
 * Handles clicks on reference links within the commentary text.
 * @param {Event} e - The click event object.
 */
export function handleReferenceClick(e) {
  const refLink = /** @type {HTMLElement} */ (e.target).closest("a.commentary-ref");
  if (!refLink) return;

  e.preventDefault();
  const slug = refLink.dataset.refSlug;
  const path = refLink.dataset.refPath;
  const libraryEntry = state.getTextFromLibrary(slug);
  if (!libraryEntry) return;

  if (libraryEntry.isInternal) {
    const newPath = `/${slug}/${path}`;
    navigateTo(newPath);
    closeMobileOverlays();
  } else {
    alert(
      `External Reference:\n\n` +
      `Text: ${libraryEntry.name}\n` +
      `Path: ${slug}/${path}\n\n` +
      `(Full content for this text is not available in the app)`
    );
  }
}

/**
 * Navigates to the next or previous top-level section.
 * @param {"prev"|"next"} direction - The direction to navigate.
 */
export function navigateArrows(direction) {
  const { currentLocation, currentUpanishadData, currentTextSlug } = state.getState();
  if (!currentUpanishadData) return;

  const topLevelSections = currentUpanishadData.content;
  const currentIndex = currentLocation.level0;
  const targetIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;

  if (targetIndex >= 0 && targetIndex < topLevelSections.length) {
    const targetSection = topLevelSections[targetIndex];
    const newPath = `/${currentTextSlug}/${targetSection.number}`;
    navigateTo(newPath);
  }
}