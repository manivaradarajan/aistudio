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
  // Get a unique ID for this specific navigation request.
  const requestId = state.getNewNavigationRequestId(); // <-- FIX: Generate new request ID

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

  // Pass the request ID to the rendering logic.
  await loadAndRenderSection(pathParts, requestId); // <-- FIX: Pass ID down
  state.setUserInitiatedClick(false);
  state.setUiStatus("idle");
}

async function loadAndRenderSection(pathParts, requestId) {
  // <-- FIX: Accept ID
  // --- FIX: Race Condition Abort ---
  // Yield to the event loop with a microtask. This allows any subsequent,
  // rapid-fire navigation events to be processed and update the global request ID.
  await Promise.resolve();

  // Before performing any logic or DOM updates, check if this request has been
  // superseded by a newer one. If so, abort immediately to prevent flashing.
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
        commonUI.showLoading("Loading section...");
        const lazyChildren = await loadLazySection(node.file);
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
        return; // Stop processing if lazy load fails
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

  state.setCurrentLocation(location);
  contentUI.setContentTitle(titleParts.join(" - "));
  contentUI.renderSectionItems(dataTraversal);

  // Determine which item to select. If the URL specifies a full path to an item, use that.
  // Otherwise (if URL only specifies a section), default to the first item in the section.
  const hasSpecificItemInUrl =
    pathParts.length > upanishadData.structure_levels.length - 1;
  const itemNumber = hasSpecificItemInUrl
    ? parseInt(pathParts[pathParts.length - 1], 10)
    : dataTraversal?.[0]?.number;

  const itemToSelect =
    dataTraversal?.find((item) => item.number === itemNumber) ||
    dataTraversal?.[0];

  if (itemToSelect) {
    contentUI.showItemDetails(itemToSelect.id);
  } else {
    contentUI.renderCommentary({
      commentary_text: "No items in this section.",
    });
    // Still need to update arrows and navigator even if section is empty
    navUI.updateNavigatorState();
    updateArrowButtons();
  }
}
