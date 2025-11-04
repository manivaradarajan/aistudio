// js/app.js
import { DOM_SELECTORS } from "./constants.js";
import * as state from "./state.js";
import { loadTextsManifest } from "./api.js";
import { cacheDomElements, isMobileView } from "./utils.js";
import { handleRouteChange, navigateTo } from "./router.js";
import {
  initMobileUI,
  openMobileOverlay,
  closeMobileOverlays,
} from "./ui/mobile.js";
import * as commonUI from "./ui/common.js";
import * as navUI from "./ui/navigator.js";
import * as contentUI from "./ui/content.js";

// --- Global DOM Cache ---
let dom;

// --- Main Initialization ---
document.addEventListener("DOMContentLoaded", init);

async function init() {
  dom = cacheDomElements(DOM_SELECTORS);
  initModules();
  addEventListeners();

  try {
    const allTexts = await loadTextsManifest();
    state.setAllTexts(allTexts);
    commonUI.populateTextSelector(allTexts);
    await handleRouteChange();
  } catch (error) {
    console.error("Initialization failed:", error);
    commonUI.showError("Failed to load application. Please refresh the page.");
  }
}

function initModules() {
  initMobileUI(dom);
  commonUI.initCommonUI(dom);
  navUI.initNavigator(dom);
  contentUI.initContent(dom);
}

function addEventListeners() {
  window.addEventListener("hashchange", handleRouteChange);
  dom.textSelector.addEventListener("change", handleTextChange);
  dom.navigatorContent.addEventListener("click", handleNavigatorClick);
  dom.mantraDisplay.addEventListener("click", handleMantraClick);
  dom.prevBtn.addEventListener("click", () => navigateArrows("prev"));
  dom.nextBtn.addEventListener("click", () => navigateArrows("next"));
  dom.mobileNavToggle.addEventListener("click", () =>
    openMobileOverlay(dom.navigatorPane)
  );
  dom.mobileNavClose.addEventListener("click", closeMobileOverlays);
  dom.mobileCommentaryClose.addEventListener("click", closeMobileOverlays);
  dom.mobileOverlay.addEventListener("click", closeMobileOverlays);
}

// --- Event Handlers ---

function handleTextChange(e) {
  navigateTo(`/${e.target.value}`);
}

function handleNavigatorClick(e) {
  if (e.target.closest("a")) {
    closeMobileOverlays();
  }
}

function handleMantraClick(e) {
  const container = e.target.closest(DOM_SELECTORS.itemContainer);
  if (!container) return;

  const itemId = container.dataset.id;
  const itemData = state.getNodeById(itemId);
  if (!itemData) return;

  const { numberPath } = itemData;
  const newPath = `/${state.getCurrentTextSlug()}/${numberPath.join("/")}`;
  const newHash = `#${newPath}`;

  state.setUserInitiatedClick(true);
  if (window.location.hash === newHash && isMobileView()) {
    contentUI.showItemDetails(itemId); // Re-trigger to open commentary
  } else {
    navigateTo(newPath);
  }
}

// --- Arrow Navigation ---

/**
 * Updates the enabled/disabled state of the previous/next arrow buttons.
 * This is now based on the application state, not the DOM.
 */
export function updateArrowButtons() {
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

/**
 * Navigates to the adjacent (previous or next) section using data from the state.
 * @param {'prev' | 'next'} direction - The direction to navigate.
 */
function navigateArrows(direction) {
  const { currentLocation, currentUpanishadData, currentTextSlug } =
    state.getState();
  if (!currentUpanishadData) return;

  const topLevelSections = currentUpanishadData.content;
  const currentIndex = currentLocation.level0;
  const targetIndex =
    direction === "next" ? currentIndex + 1 : currentIndex - 1;

  if (targetIndex >= 0 && targetIndex < topLevelSections.length) {
    const targetSection = topLevelSections[targetIndex];
    // Navigate to the section itself, not a specific item within it.
    // The router will handle selecting the first item on desktop.
    const newPath = `/${currentTextSlug}/${targetSection.number}`;
    navigateTo(newPath);
  }
}
