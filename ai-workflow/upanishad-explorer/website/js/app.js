// js/app.js

/**
 * @file This is the main entry point for the Upanishad Explorer application.
 * @module app
 */

import { DOM_SELECTORS, CONFIG } from "./constants.js";
import * as state from "./state.js";
import { cacheDomElements } from "./utils.js";
import { handleRouteChange } from "./router.js";
import { initMobileUI, openMobileOverlay, closeMobileOverlays } from "./ui/mobile.js";
import * as commonUI from "./ui/common.js";
import * as navUI from "./ui/navigator.js";
import * as contentUI from "./ui/content.js";
import * as events from "./events.js";
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
    state.initializeLibrary(fullLibraryData);

    state.updateState({ allTexts: internalData });
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
  dom.textSelector.addEventListener("change", events.handleTextChange);
  dom.refToggle.addEventListener("change", events.handleRefToggleChange);
  dom.navigatorContent.addEventListener("click", events.handleNavigatorClick);
  dom.mantraDisplay.addEventListener("click", events.handleMantraClick);
  dom.commentaryText.addEventListener("click", events.handleReferenceClick);
  dom.prevBtn.addEventListener("click", () => events.navigateArrows("prev"));
  dom.nextBtn.addEventListener("click", () => events.navigateArrows("next"));

  dom.mobileNavToggle.addEventListener("click", () => openMobileOverlay(/** @type {HTMLElement} */ (dom.navigatorPane)));
  dom.mobileNavClose.addEventListener("click", closeMobileOverlays);
  dom.mobileCommentaryClose.addEventListener("click", closeMobileOverlays);
  dom.mobileOverlay.addEventListener("click", closeMobileOverlays);
}