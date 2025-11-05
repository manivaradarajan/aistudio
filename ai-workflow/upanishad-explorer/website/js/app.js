// js/app.js

/**
 * @file This is the main entry point for the Upanishad Explorer application.
 * @module app
 */

import { DOM_SELECTORS, CONFIG } from "./constants.js";
import * as state from "./state.js";
import { cacheDomElements, isMobileView } from "./utils.js";
import { handleRouteChange, navigateTo } from "./router.js";
import { initMobileUI, openMobileOverlay, closeMobileOverlays } from "./ui/mobile.js";
import * as commonUI from "./ui/common.js";
import * as navUI from "./ui/navigator.js";
import * as contentUI from "./ui/content.js";
import "./types.js"; // Import JSDoc type definitions

/**
 * A cached map of frequently used DOM elements.
 * @type {Object.<string, HTMLElement>}
 */
let dom;

document.addEventListener("DOMContentLoaded", init);

/**
 * The main initialization function for the application.
 */
async function init() {
  dom = cacheDomElements(DOM_SELECTORS);
  initModules();
  addEventListeners();

  try {
    const [internalData, externalData] = await Promise.all([
      fetch(CONFIG.INTERNAL_MANIFEST).then(res => res.json()),
      fetch(CONFIG.EXTERNAL_MANIFEST).then(res => res.json())
    ]);

    const fullLibraryData = [...internalData, ...externalData];
    state.setLibraryData(fullLibraryData);

    state.setAllTexts(internalData);
    commonUI.populateTextSelector(internalData);

    await handleRouteChange();
  } catch (error) {
    console.error("Initialization failed:", error);
    commonUI.showError("Failed to load application. Please refresh the page.");
  }
}

/**
 * Initializes all the UI and state modules.
 */
function initModules() {
  initMobileUI(dom);
  commonUI.initCommonUI(dom);
  navUI.initNavigator(dom);
  contentUI.initContent(dom);
}

/**
 * Adds all necessary event listeners for the application.
 */
function addEventListeners() {
  window.addEventListener("hashchange", handleRouteChange);
  dom.textSelector.addEventListener("change", handleTextChange);
  dom.refToggle.addEventListener("change", handleRefToggleChange);
  dom.navigatorContent.addEventListener("click", handleNavigatorClick);
  dom.mantraDisplay.addEventListener("click", handleMantraClick);
  dom.commentaryText.addEventListener("click", handleReferenceClick);
  dom.prevBtn.addEventListener("click", () => navigateArrows("prev"));
  dom.nextBtn.addEventListener("click", () => navigateArrows("next"));

  dom.mobileNavToggle.addEventListener("click", () => openMobileOverlay(/** @type {HTMLElement} */ (dom.navigatorPane)));
  dom.mobileNavClose.addEventListener("click", closeMobileOverlays);
  dom.mobileCommentaryClose.addEventListener("click", closeMobileOverlays);
  dom.mobileOverlay.addEventListener("click", closeMobileOverlays);
}

/**
 * Handles the change event on the main text selector dropdown.
 * @param {Event} e - The change event object.
 */
function handleTextChange(e) { navigateTo(`/${/** @type {HTMLSelectElement} */ (e.target).value}`); }

/**
 * Handles the change event on the toggle for external references.
 * @param {Event} e - The change event object.
 */
function handleRefToggleChange(e) {
  const shouldShow = /** @type {HTMLInputElement} */ (e.target).checked;
  state.setShowExternalRefs(shouldShow);
  const selectedItem = /** @type {HTMLElement} */ (dom.mantraDisplay.querySelector(".selected"));
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
function handleNavigatorClick(e) { if (/** @type {HTMLElement} */ (e.target).closest("a")) { closeMobileOverlays(); } }

/**
 * Handles clicks on individual items in the main content pane.
 * @param {Event} e - The click event object.
 */
function handleMantraClick(e) {
  const container = /** @type {HTMLElement} */ (e.target).closest(DOM_SELECTORS.itemContainer);
  if (!container) return;

  const itemId = container.dataset.id;
  const itemData = state.getNodeById(itemId);
  if (!itemData) return;

  const { numberPath } = itemData;
  const newPath = `/${state.getCurrentTextSlug()}/${numberPath.join("/")}`;
  const newHash = `#${newPath}`;

  state.setUserInitiatedClick(true);

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
function handleReferenceClick(e) {
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
function navigateArrows(direction) {
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