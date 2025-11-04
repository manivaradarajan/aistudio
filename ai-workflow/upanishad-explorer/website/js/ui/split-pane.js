// js/ui/split-pane.js
import { CONFIG, DOM_SELECTORS } from "../constants.js";
import { isMobileView } from "../utils.js";

/**
 * Initializes the split pane layout for desktop view.
 * Destroys existing instances if they exist.
 */
export function initializeSplitPanes() {
  if (!window.Split || isMobileView()) return;

  // Clean up any existing splitters
  document.querySelectorAll(".gutter").forEach((g) => g.remove());

  window.Split(
    [
      DOM_SELECTORS.navigatorPane,
      DOM_SELECTORS.mainPane,
      DOM_SELECTORS.commentaryPane,
    ],
    CONFIG.SPLIT_CONFIG
  );
}
