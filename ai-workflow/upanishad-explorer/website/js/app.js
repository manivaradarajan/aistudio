import { DOM_SELECTORS } from "./constants.js";
import * as state from "./state.js";
import { loadTextsManifest } from "./api.js";
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
    const libraryData = await loadTextsManifest();
    state.setLibraryData(libraryData);
    const internalTexts = libraryData.filter(text => text.isInternal);
    state.setAllTexts(internalTexts);
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

function addEventListeners() {
  window.addEventListener("hashchange", handleRouteChange);
  dom.textSelector.addEventListener("change", handleTextChange);
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