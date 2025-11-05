// js/app.js
import { DOM_SELECTORS, CONFIG } from "./constants.js"; // Import CONFIG
import * as state from "./state.js";
import { loadTextData } from "./api.js"; // Note: loadTextsManifest is no longer used here
import { cacheDomElements, isMobileView } from "./utils.js";
import { handleRouteChange, navigateTo } from "./router.js";
import { initMobileUI, openMobileOverlay, closeMobileOverlays } from "./ui/mobile.js";
import * as commonUI from "./ui/common.js";
import * as navUI from "./ui/navigator.js";
import * as contentUI from "./ui/content.js";

let dom;
document.addEventListener("DOMContentLoaded", init);

async function init() {
  dom = cacheDomElements(DOM_SELECTORS);
  initModules();
  addEventListeners();

  try {
    // 1. Fetch both library files in parallel
    const [internalData, externalData] = await Promise.all([
      fetch(CONFIG.INTERNAL_MANIFEST).then(res => res.json()),
      fetch(CONFIG.EXTERNAL_MANIFEST).then(res => res.json())
    ]);

    // 2. Combine them into a single library for the alias map
    const fullLibraryData = [...internalData, ...externalData];
    state.setLibraryData(fullLibraryData);

    // 3. The internal data is used directly for the dropdown and routing
    state.setAllTexts(internalData);
    commonUI.populateTextSelector(internalData);

    // 4. Handle initial route
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
  dom.refToggle.addEventListener("change", handleRefToggleChange);
  dom.navigatorContent.addEventListener("click", handleNavigatorClick);
  dom.mantraDisplay.addEventListener("click", handleMantraClick);
  dom.commentaryText.addEventListener("click", handleReferenceClick);
  dom.prevBtn.addEventListener("click", () => navigateArrows("prev"));
  dom.nextBtn.addEventListener("click", () => navigateArrows("next"));
  dom.mobileNavToggle.addEventListener("click", () => openMobileOverlay(dom.navigatorPane));
  dom.mobileNavClose.addEventListener("click", closeMobileOverlays);
  dom.mobileCommentaryClose.addEventListener("click", closeMobileOverlays);
  dom.mobileOverlay.addEventListener("click", closeMobileOverlays);
}

function handleTextChange(e) { navigateTo(`/${e.target.value}`); }

function handleRefToggleChange(e) {
  const shouldShow = e.target.checked;
  state.setShowExternalRefs(shouldShow);
  const selectedItem = dom.mantraDisplay.querySelector(".selected");
  if (selectedItem) {
    const itemId = selectedItem.dataset.id;
    const itemData = state.getNodeById(itemId);
    if (itemData) {
      contentUI.renderCommentary(itemData);
    }
  }
}

function handleNavigatorClick(e) { if (e.target.closest("a")) { closeMobileOverlays(); } }

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

function handleReferenceClick(e) {
  const refLink = e.target.closest("a.commentary-ref");
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