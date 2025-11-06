// js/ui/split-pane.js

/**
 * @file This file manages the resizable split-pane layout using the Split.js library.
 * @module split-pane
 */

import { CONFIG, DOM_SELECTORS } from "../constants.js";
import { isMobileView } from "../utils.js";

/**
 * Initializes the split pane layout for the desktop view.
 * This function will not run if the view is mobile or if the Split.js library is not available.
 * It also ensures that any previously created splitters are removed before creating new ones.
 */
export function initializeSplitPanes() {
  // Do not initialize on mobile or tablet, as they use different layouts.
  if (!window.Split || window.innerWidth <= 1024) return;

  // Clean up any existing splitter elements to prevent duplicates.
  document.querySelectorAll(".gutter").forEach((g) => g.remove());

  const savedSizes = localStorage.getItem('splitSizes');
  const sizes = savedSizes ? JSON.parse(savedSizes) : CONFIG.SPLIT_CONFIG.sizes;

  // Initialize Split.js with the panes and configuration.
  window.Split(
    [
      DOM_SELECTORS.navigatorPane,
      DOM_SELECTORS.mainPane,
      DOM_SELECTORS.commentaryPane,
    ],
    {
      ...CONFIG.SPLIT_CONFIG,
      sizes,
      onDragEnd: function (sizes) {
        localStorage.setItem('splitSizes', JSON.stringify(sizes));
      },
    }
  );
}
