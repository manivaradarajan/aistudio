// js/router.js
import { loadTextData, loadLazySection } from "./api.js";
import * as state from "./state.js";
import { processTextData } from "./data-processor.js";
import * as navUI from "./ui/navigator.js";
import * as contentUI from "./ui/content.js";
import * as commonUI from "./ui/common.js";
import { initializeSplitPanes } from "./ui/split-pane.js";
import { updateArrowButtons } from "./ui/common.js";
import { isMobileView } from "./utils.js";

// ... (navigateTo and handleRouteChange are unchanged) ...
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
  await renderContentForRoute(pathParts, requestId);
  state.setUserInitiatedClick(false);
  state.setUiStatus("idle");
}


async function traverseToSection(pathParts, upanishadData) {
    const currentRequestId = state.getCurrentNavigationRequestId();
    const navLevels = upanishadData.structure_levels.slice(0, -1);

    let location = {};
    let dataTraversal = upanishadData.content;
    let titleParts = [upanishadData.text_name];

    for (let i = 0; i < navLevels.length; i++) {
        const urlNumber = parseInt(pathParts[i + 1], 10) || dataTraversal[0]?.number || 1;
        const index = dataTraversal.findIndex((item) => item.number === urlNumber);
        const validIndex = index > -1 ? index : 0;

        location[`level${i}`] = validIndex;
        let node = dataTraversal[validIndex];

        if (node.file && !node.children) {
            try {
                if (currentRequestId !== state.getCurrentNavigationRequestId()) return null;
                commonUI.showLoading("Loading section...");
                const lazyChildren = await loadLazySection(node.file);
                if (currentRequestId !== state.getCurrentNavigationRequestId()) return null;

                const { processedData: { content: processedChildren }, dataMap: lazyMap } = processTextData({ content: lazyChildren }, pathParts[0]);
                node.children = processedChildren;
                const globalDataMap = state.getState().dataMap;
                lazyMap.forEach((value, key) => globalDataMap.set(key, value));
                delete node.file;
            } catch (error) {
                console.error("Failed to load lazy section:", error);
                commonUI.showError("Failed to load the section content.");
                return null;
            }
        }

        // --- TRULY ROBUST FIX IS HERE ---
        const levelInfo = navLevels[i];
        let label = `Level ${i}`; // Default fallback
        if (levelInfo && typeof levelInfo === 'object' && levelInfo.scriptNames) {
            // New format
            label = levelInfo.scriptNames.devanagari || levelInfo.key;
        } else if (typeof levelInfo === 'string') {
            // Old format
            label = levelInfo;
        }
        // --- END FIX ---

        titleParts.push(node.name || `${label} ${node.number}`);

        dataTraversal = node.children;
    }

    return { targetItems: dataTraversal, titleParts, location };
}

// ... (renderContentForRoute is unchanged) ...
async function renderContentForRoute(pathParts, requestId) {
  await Promise.resolve();
  if (requestId !== state.getCurrentNavigationRequestId()) {
    return;
  }
  const upanishadData = state.getCurrentUpanishadData();
  const traversalResult = await traverseToSection(pathParts, upanishadData);
  if (!traversalResult) {
    return;
  }
  const { targetItems, titleParts, location } = traversalResult;
  state.setCurrentLocation(location);
  contentUI.setContentTitle(titleParts.join(" - "));
  contentUI.renderSectionItems(targetItems);
  const hasSpecificItemInUrl = pathParts.length > upanishadData.structure_levels.length;
  const itemNumberInUrl = hasSpecificItemInUrl ? parseInt(pathParts[pathParts.length - 1], 10) : undefined;
  const itemToSelect = itemNumberInUrl !== undefined ? targetItems?.find((item) => item.number === itemNumberInUrl) : targetItems?.[0];
  if (!itemToSelect) {
    contentUI.clearSelection();
    navUI.updateNavigatorState();
    updateArrowButtons();
    return;
  }
  if (hasSpecificItemInUrl) {
    contentUI.showItemDetails(itemToSelect.id);
  } else {
    contentUI.resetContentScroll();
    if (isMobileView()) {
      contentUI.clearSelection();
      navUI.updateNavigatorState();
      updateArrowButtons();
    } else {
      contentUI.selectItem(itemToSelect.id);
    }
  }
}