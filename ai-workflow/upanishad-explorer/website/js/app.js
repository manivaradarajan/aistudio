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
 * Exported so it can be called from the router after content renders.
 */
export function updateArrowButtons() {
  const navigatorRootUl = dom.navigatorContent.querySelector("ul");
  if (!navigatorRootUl) {
    dom.prevBtn.disabled = true;
    dom.nextBtn.disabled = true;
    return;
  }

  // A "section" is a top-level list item in the navigator.
  const allSectionContainers = Array.from(navigatorRootUl.children);
  if (allSectionContainers.length <= 1) {
    dom.prevBtn.disabled = true;
    dom.nextBtn.disabled = true;
    return;
  }

  const currentLink = dom.navigatorContent.querySelector("a.active");
  const currentSectionContainer = currentLink
    ? currentLink.closest("#navigator-content > ul > li")
    : null;
  const currentIndex = currentSectionContainer
    ? allSectionContainers.indexOf(currentSectionContainer)
    : -1;

  dom.prevBtn.disabled = currentIndex <= 0;
  dom.nextBtn.disabled =
    currentIndex === -1 || currentIndex >= allSectionContainers.length - 1;
}

/**
 * Navigates to the adjacent (previous or next) section.
 * @param {'prev' | 'next'} direction - The direction to navigate.
 */
function navigateArrows(direction) {
  const navigatorRootUl = dom.navigatorContent.querySelector("ul");
  if (!navigatorRootUl) return;

  const allSectionContainers = Array.from(navigatorRootUl.children);
  const currentLink = dom.navigatorContent.querySelector("a.active");
  const currentSectionContainer = currentLink
    ? currentLink.closest("#navigator-content > ul > li")
    : null;
  if (!currentSectionContainer) return;

  const currentIndex = allSectionContainers.indexOf(currentSectionContainer);
  let targetIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;

  if (targetIndex >= 0 && targetIndex < allSectionContainers.length) {
    const targetContainer = allSectionContainers[targetIndex];
    // Find the first actual link inside the target section container to navigate to.
    const targetLink = targetContainer.querySelector("a");
    if (targetLink) {
      navigateTo(targetLink.getAttribute("href").substring(1));
    }
  }
}
