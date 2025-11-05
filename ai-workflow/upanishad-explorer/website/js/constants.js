// js/constants.js

/**
 * @file This file defines constants used throughout the application, including DOM selectors, configuration values, and UI states.
 * @module constants
 */

/**
 * A map of CSS selectors for frequently accessed DOM elements.
 * This centralizes element selection and makes it easier to update if the HTML structure changes.
 * @type {import('./types.js').DomSelectorMap}
 */
export const DOM_SELECTORS = {
  body: document.body,
  textSelector: "#text-selector",
  navigatorPane: "#nav-pane",
  commentaryPane: "#commentary-pane",
  mainPane: "#main-pane",
  navigatorContent: "#navigator-content",
  contentTitle: "#content-title",
  mantraDisplay: "#mantra-display",
  commentaryText: "#commentary-text",
  mobileNavToggle: "#mobile-nav-toggle",
  mobileNavClose: "#mobile-nav-close",
  mobileCommentaryClose: "#mobile-commentary-close",
  mobileOverlay: "#mobile-overlay",
  prevBtn: "#prev-section",
  nextBtn: "#next-section",
  itemContainer: ".item-container",
  activeNavLink: "a.active",
  selectedItem: ".selected",
  refToggle: "#toggle-external-refs",
};

/**
 * Configuration constants for the application.
 * @type {import('./types.js').AppConfig}
 */
export const CONFIG = {
  INTERNAL_MANIFEST: "library-internal.json",
  EXTERNAL_MANIFEST: "library-external.json",
  MOBILE_BREAKPOINT: 800,
  SPLIT_CONFIG: {
    sizes: [25, 45, 30],
    minSize: [200, 300, 300],
    gutterSize: 2,
    cursor: "col-resize",
  },
};

/**
 * An enumeration of possible UI states.
 * @readonly
 * @enum {string}
 */
export const UI_STATUS = {
  IDLE: "idle",
  LOADING: "loading",
  ERROR: "error",
};
