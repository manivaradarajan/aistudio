// js/router.js
import { loadTextData, loadLazySection } from "./api.js";
import * as state from "./state.js";
import { processTextData } from "./data-processor.js";
import * as navUI from "./ui/navigator.js";
import * as contentUI from "./ui/content.js";
import * as commonUI from "./ui/common.js";
import { initializeSplitPanes } from "./ui/split-pane.js";
import { updateArrowButtons } from "./app.js";
import { CONFIG } from "./constants.js";
import { isMobileView } from "./utils.js";

/**
 * Navigates to a new hash path, updating the URL.
 * @param {string} path - The new path, e.g., `/slug/1/2`.
 */
export function navigateTo(path) {
  if (window.location.hash !== `#${path}`) {
    window.location.hash = path;
  }
}

/**
 * Main routing function triggered on hash change or initial load.
 */
export async function handleRouteChange() {
  const requestId = state.getNewNavigationRequestId();

  state.setUiStatus("loading");
  const { allTexts } = state.getState();
  const pathParts = window.location.hash.slice(1).split("/").filter(Boolean);
  const textSlug = pathParts[0] || allTexts[0]?.slug;

  const targetText = allTexts.find((t) => t.slug === textSlug);
  if (!targetText) {
    const fallback = allTexts[0]?.slug;
    if (fallback) navigateTo(`/${fallback}`);
    return;
  }

  if (textSlug !== state.getCurrentTextSlug()) {
    try {
      const rawData = await loadTextData(targetText.file);
      const { processedData, dataMap } = processTextData(rawData, textSlug);
      state.setCurrentText(textSlug, processedData, dataMap);
      document.getElementById("text-selector").value = textSlug;
      navUI.renderNavigator();
      initializeSplitPanes();
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Failed to load text:", error);
        commonUI.showError("Failed to load the selected text.");
        state.setUiStatus("error");
      }
      return;
    }
  }

  await loadAndRenderSection(pathParts, requestId);
  state.setUserInitiatedClick(false); // Reset the flag after every navigation is complete
  state.setUiStatus("idle");
}

async function loadAndRenderSection(pathParts, requestId) {
  await Promise.resolve();
  if (requestId !== state.getCurrentNavigationRequestId()) {
    return;
  }

  const upanishadData = state.getCurrentUpanishadData();
  const navLevels = upanishadData.structure_levels.slice(0, -1);
  let location = {};
  let dataTraversal = upanishadData.content;
  let titleParts = [upanishadData.text_name];

  for (let i = 0; i < navLevels.length; i++) {
    const urlNumber =
      parseInt(pathParts[i + 1], 10) || dataTraversal[0]?.number || 1;
    const index = dataTraversal.findIndex((item) => item.number === urlNumber);
    const validIndex = index > -1 ? index : 0;

    location[`level${i}`] = validIndex;
    let node = dataTraversal[validIndex];

    if (node.file && !node.children) {
      try {
        if (requestId !== state.getCurrentNavigationRequestId()) return;
        commonUI.showLoading("Loading section...");
        const lazyChildren = await loadLazySection(node.file);
        if (requestId !== state.getCurrentNavigationRequestId()) return;
        const {
          processedData: { content: processedChildren },
          dataMap: lazyMap,
        } = processTextData({ content: lazyChildren }, pathParts[0]);
        node.children = processedChildren;
        const globalDataMap = state.getState().dataMap;
        lazyMap.forEach((value, key) => globalDataMap.set(key, value));
        delete node.file;
      } catch (error) {
        console.error("Failed to load lazy section:", error);
        commonUI.showError("Failed to load the section content.");
        return;
      }
    }

    titleParts.push(
      node.name ||
        `${CONFIG.DEVANAGARI_LABELS[navLevels[i]] || navLevels[i]} ${
          node.number
        }`
    );
    dataTraversal = node.children;
  }

  if (requestId !== state.getCurrentNavigationRequestId()) {
    return;
  }

  state.setCurrentLocation(location);
  contentUI.setContentTitle(titleParts.join(" - "));
  contentUI.renderSectionItems(dataTraversal);

  // This check now correctly distinguishes between section-level and item-level URLs.
  const hasSpecificItemInUrl =
    pathParts.length > upanishadData.structure_levels.length - 1;

  const itemNumberInUrl = hasSpecificItemInUrl
    ? parseInt(pathParts[pathParts.length - 1], 10)
    : undefined;

  const itemToSelect = itemNumberInUrl !== undefined
    ? dataTraversal?.find((item) => item.number === itemNumberInUrl)
    : dataTraversal?.[0];

  if (!itemToSelect) {
    // Empty section or item not found
    contentUI.clearSelection();
    navUI.updateNavigatorState();
    updateArrowButtons();
    return;
  }

  // --- REVISED LOGIC ---
  // If the URL specifies a particular item, OR if we're on desktop (where we always select the first item of a section),
  // then we must show the details for that item.
  if (hasSpecificItemInUrl || !isMobileView()) {
    contentUI.showItemDetails(itemToSelect.id);
  } else {
    // This block now ONLY runs on mobile when navigating to a section-level URL (e.g., /#/taittiriya/1).
    // This is the only case where we want to clear selection and scroll to the top.
    contentUI.resetContentScroll(); // (This function was added in the previous fix)
    contentUI.clearSelection();
    navUI.updateNavigatorState();
    updateArrowButtons();
  }
}