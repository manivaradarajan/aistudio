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

// --- MODIFIED FUNCTION ---
async function init() {
  dom = cacheDomElements(DOM_SELECTORS);
  initModules();
  addEventListeners();

  try {
    // 1. Load the entire library
    const libraryData = await loadTextsManifest();
    state.setLibraryData(libraryData); // Store it in state and build the alias map

    // 2. Filter for internal texts to populate the dropdown
    const internalTexts = libraryData.filter(text => text.isInternal);
    state.setAllTexts(internalTexts); // Keep using this for dropdown/router logic

    // 3. Populate UI and handle initial route
    commonUI.populateTextSelector(internalTexts);
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

// --- MODIFIED FUNCTION ---
function addEventListeners() {
  window.addEventListener("hashchange", handleRouteChange);
  dom.textSelector.addEventListener("change", handleTextChange);
  dom.navigatorContent.addEventListener("click", handleNavigatorClick);
  dom.mantraDisplay.addEventListener("click", handleMantraClick);

  // ADD THIS NEW LISTENER
  dom.commentaryText.addEventListener("click", handleReferenceClick);

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
    contentUI.showItemDetails(itemId);
  } else {
    navigateTo(newPath);
  }
}

// --- NEW FUNCTION ---
/**
 * Handles clicks on reference links within the commentary pane.
 * @param {MouseEvent} e - The click event.
 */
function handleReferenceClick(e) {
  const refLink = e.target.closest("a.commentary-ref");
  if (!refLink) return;

  e.preventDefault(); // Prevent the default link behavior

  const slug = refLink.dataset.refSlug;
  const path = refLink.dataset.refPath;
  const libraryEntry = state.getTextFromLibrary(slug);

  if (!libraryEntry) return;

  if (libraryEntry.isInternal) {
    // For texts hosted in this app, navigate internally
    const newPath = `/${slug}/${path}`;
    navigateTo(newPath);
    closeMobileOverlays(); // Helpful on mobile
  } else {
    // For external texts, just show an alert for now.
    // This could be replaced with a modal popup in the future.
    alert(
      `External Reference:\n\n` +
      `Text: ${libraryEntry.name}\n` +
      `Path: ${slug}/${path}\n\n` +
      `(Full content for this text is not available in the app)`
    );
  }
}


// ... (updateArrowButtons and navigateArrows remain the same) ...
export function updateArrowButtons() {
  const { currentLocation, currentUpanishadData } = state.getState();
  if (!currentUpanishadData || !currentLocation) {
    dom.prevBtn.disabled = true;
    dom.nextBtn.disabled = true;
    return;
  }
  const topLevelSections = currentUpanishadData.content;
  const currentIndex = currentLocation.level0;
  if (topLevelSections.length <= 1) {
    dom.prevBtn.disabled = true;
    dom.nextBtn.disabled = true;
    return;
  }
  dom.prevBtn.disabled = currentIndex <= 0;
  dom.nextBtn.disabled = currentIndex >= topLevelSections.length - 1;
}
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