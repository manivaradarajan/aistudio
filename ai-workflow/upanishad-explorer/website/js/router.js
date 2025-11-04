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

// ... (navigateTo and handleRouteChange functions remain the same) ...

export function navigateTo(path) {
  if (window.location.hash !== `#${path}`) {
    window.location.hash = path;
  }
}

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

  // FIX: This logic is now correct.
  const hasSpecificItemInUrl =
    pathParts.length > upanishadData.structure_levels.length;

  const itemNumberInUrl = hasSpecificItemInUrl
    ? parseInt(pathParts[pathParts.length - 1], 10)
    : undefined;

  const itemToSelect = itemNumberInUrl !== undefined
    ? dataTraversal?.find((item) => item.number === itemNumberInUrl)
    : dataTraversal?.[0];

  if (!itemToSelect) {
    contentUI.clearSelection();
    navUI.updateNavigatorState();
    updateArrowButtons();
    return;
  }

  // --- ADDED CONSOLE LOGGING ---
  console.log(
    `[Router] Path: /${pathParts.join("/")}`,
    `| hasSpecificItemInUrl: ${hasSpecificItemInUrl}`,
    `| isMobileView: ${isMobileView()}`
  );

  if (hasSpecificItemInUrl) {
    console.log("[Router] Path has specific item. Calling showItemDetails.");
    contentUI.showItemDetails(itemToSelect.id);
  } else {
    console.log("[Router] Path is for a section. Resetting scroll.");
    contentUI.resetContentScroll();

    if (isMobileView()) {
      console.log("[Router] Mobile view. Clearing selection.");
      contentUI.clearSelection();
      navUI.updateNavigatorState();
      updateArrowButtons();
    } else {
      console.log("[Router] Desktop view. Calling selectItem to avoid centering.");
      contentUI.selectItem(itemToSelect.id);
    }
  }
}