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

// --- Core Navigation and Routing ---

/**
 * Navigates to a new hash path, which triggers the 'hashchange' event listener.
 * This is the primary programmatic way to change the application's view.
 * @param {string} path - The new path, e.g., `/slug/1/2`.
 */
export function navigateTo(path) {
  if (window.location.hash !== `#${path}`) {
    window.location.hash = path;
  }
}

/**
 * The main router function, triggered on initial load and on every 'hashchange' event.
 * It acts as the central controller for the application's state transitions.
 */
export async function handleRouteChange() {
  // 1. Get a unique ID for this navigation request to handle race conditions.
  const requestId = state.getNewNavigationRequestId();
  state.setUiStatus("loading");

  const { allTexts } = state.getState();
  const pathParts = window.location.hash.slice(1).split("/").filter(Boolean);
  const textSlug = pathParts[0] || allTexts[0]?.slug;

  // 2. Validate the requested text slug. If invalid, redirect to the first available text.
  const targetText = allTexts.find((t) => t.slug === textSlug);
  if (!targetText) {
    const fallback = allTexts[0]?.slug;
    if (fallback) navigateTo(`/${fallback}`);
    return;
  }

  // 3. If the text is changing, load its main JSON file and rebuild the navigator.
  if (textSlug !== state.getCurrentTextSlug()) {
    try {
      const rawData = await loadTextData(targetText.file);
      const { processedData, dataMap } = processTextData(rawData, textSlug);
      state.setCurrentText(textSlug, processedData, dataMap);

      // Update UI elements related to the text itself
      document.getElementById("text-selector").value = textSlug;
      navUI.renderNavigator();
      initializeSplitPanes(); // Re-initialize split panes for the new layout
    } catch (error) {
      // Don't show an error if the request was intentionally aborted by a newer one.
      if (error.name !== "AbortError") {
        console.error("Failed to load text:", error);
        commonUI.showError("Failed to load the selected text.");
        state.setUiStatus("error");
      }
      return;
    }
  }

  // 4. Render the specific section and item based on the full URL path.
  await renderContentForRoute(pathParts, requestId);

  // 5. Reset state for the next user interaction.
  state.setUserInitiatedClick(false);
  state.setUiStatus("idle");
}

/**
 * Traverses the data structure based on the URL to find the target section and items.
 * This function also handles lazy-loading of data files as it traverses.
 * @param {string[]} pathParts - The parts of the URL hash (e.g., ['katha', '1', '20']).
 * @param {object} upanishadData - The full data object for the current text.
 * @returns {Promise<{targetItems: object[], titleParts: string[], location: object}|null>} An object containing the items to render, the parts for the title, and the location indices, or null if aborted.
 */
async function traverseToSection(pathParts, upanishadData) {
  const currentRequestId = state.getCurrentNavigationRequestId();
  const navLevels = upanishadData.structure_levels.slice(0, -1); // Navigation levels (e.g., Valli, Khanda)

  let location = {}; // Stores the index-based path for state
  let dataTraversal = upanishadData.content; // Start traversal from the top level
  let titleParts = [upanishadData.text_name]; // For building the H1 title

  for (let i = 0; i < navLevels.length; i++) {
    const urlNumber = parseInt(pathParts[i + 1], 10) || dataTraversal[0]?.number || 1;
    const index = dataTraversal.findIndex((item) => item.number === urlNumber);
    const validIndex = index > -1 ? index : 0;

    location[`level${i}`] = validIndex;
    let node = dataTraversal[validIndex];

    // --- Lazy Loading Logic ---
    // If a node has a 'file' property but no 'children', it's a placeholder for data in another file.
    if (node.file && !node.children) {
      try {
        if (currentRequestId !== state.getCurrentNavigationRequestId()) return null; // Abort if a new request came in
        commonUI.showLoading("Loading section...");
        const lazyChildren = await loadLazySection(node.file);
        if (currentRequestId !== state.getCurrentNavigationRequestId()) return null; // Abort again after await

        // Process and integrate the lazy-loaded data into the main state.
        const { processedData: { content: processedChildren }, dataMap: lazyMap } = processTextData({ content: lazyChildren }, pathParts[0]);
        node.children = processedChildren;
        const globalDataMap = state.getState().dataMap;
        lazyMap.forEach((value, key) => globalDataMap.set(key, value));
        delete node.file; // Remove the file property to prevent re-fetching
      } catch (error) {
        console.error("Failed to load lazy section:", error);
        commonUI.showError("Failed to load the section content.");
        return null;
      }
    }

    titleParts.push(node.name || `${CONFIG.DEVANAGARI_LABELS[navLevels[i]] || navLevels[i]} ${node.number}`);
    dataTraversal = node.children;
  }

  return { targetItems: dataTraversal, titleParts, location };
}

/**
 * Renders the content for a given route after the data has been traversed.
 * This function contains the critical logic for what to display and how to scroll.
 * @param {string[]} pathParts - The parts of the URL hash.
 * @param {number} requestId - The unique ID for this rendering request.
 */
async function renderContentForRoute(pathParts, requestId) {
  // Yield to the event loop and then check if this request is still the latest one.
  // This is the core of the race condition prevention.
  await Promise.resolve();
  if (requestId !== state.getCurrentNavigationRequestId()) {
    return;
  }

  const upanishadData = state.getCurrentUpanishadData();
  const traversalResult = await traverseToSection(pathParts, upanishadData);

  if (!traversalResult) {
    // Traversal was aborted or failed, so stop.
    return;
  }

  const { targetItems, titleParts, location } = traversalResult;
  state.setCurrentLocation(location);

  // --- Update the Main View ---
  contentUI.setContentTitle(titleParts.join(" - "));
  contentUI.renderSectionItems(targetItems);

  // --- Determine Selection and Scrolling Behavior ---

  // A URL has a specific item if its path is longer than the number of structural levels.
  // e.g., for katha (2 levels: Valli, Mantra), '/katha/1' is a section, but '/katha/1/20' is an item.
  const hasSpecificItemInUrl = pathParts.length > upanishadData.structure_levels.length;

  const itemNumberInUrl = hasSpecificItemInUrl
    ? parseInt(pathParts[pathParts.length - 1], 10)
    : undefined;

  // Find the target item in the URL, or default to the first item of the section.
  const itemToSelect = itemNumberInUrl !== undefined
    ? targetItems?.find((item) => item.number === itemNumberInUrl)
    : targetItems?.[0];

  if (!itemToSelect) {
    // This section is empty or the item wasn't found.
    contentUI.clearSelection();
    navUI.updateNavigatorState();
    updateArrowButtons();
    return;
  }

  // --- This is the key logic block that handles all UI state scenarios ---

  if (hasSpecificItemInUrl) {
    // SCENARIO 1: The URL points to a specific item.
    // This happens on deep link load or when a user clicks a specific mantra.
    // The desired behavior is ALWAYS to scroll to and highlight that item.
    contentUI.showItemDetails(itemToSelect.id);
  } else {
    // SCENARIO 2: The URL points to a section.
    // This happens when navigating with arrows or clicking a section header in the TOC.
    // The desired behavior is to show the section from the top.
    contentUI.resetContentScroll();

    if (isMobileView()) {
      // On mobile's "reader" mode, we don't pre-select any item.
      contentUI.clearSelection();
      navUI.updateNavigatorState();
      updateArrowButtons();
    } else {
      // On desktop's "workbench" mode, we select the first item for context,
      // but we use selectItem() to avoid the jarring "scroll to center" behavior.
      contentUI.selectItem(itemToSelect.id);
    }
  }
}