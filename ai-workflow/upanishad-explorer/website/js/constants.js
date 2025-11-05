// js/constants.js

/**
 * @file This file defines constants used throughout the application, including DOM selectors, configuration values, and UI states.
 * @module constants
 */

/**
 * @typedef {Object.<string, (HTMLElement|string)>} DomSelectorMap
 * @property {HTMLElement} body
 * @property {string} textSelector
 * @property {string} navigatorPane
 * @property {string} commentaryPane
 * @property {string} mainPane
 * @property {string} navigatorContent
 * @property {string} contentTitle
 * @property {string} mantraDisplay
 * @property {string} commentaryText
 * @property {string} mobileNavToggle
 * @property {string} mobileNavClose
 * @property {string} mobileCommentaryClose
 * @property {string} mobileOverlay
 * @property {string} prevBtn
 * @property {string} nextBtn
 * @property {string} itemContainer
 * @property {string} activeNavLink
 * @property {string} selectedItem
 * @property {string} refToggle
 */

/**
 * A map of CSS selectors for frequently accessed DOM elements.
 * This centralizes element selection and makes it easier to update if the HTML structure changes.
 * @type {DomSelectorMap}
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
 * @typedef {object} AppConfig
 * @property {string} INTERNAL_MANIFEST
 * @property {string} EXTERNAL_MANIFEST
 * @property {number} MOBILE_BREAKPOINT
 * @property {object} SPLIT_CONFIG
 * @property {number[]} SPLIT_CONFIG.sizes
 * @property {number[]} SPLIT_CONFIG.minSize
 * @property {number} SPLIT_CONFIG.gutterSize
 * @property {string} SPLIT_CONFIG.cursor
 */

/**
 * Configuration constants for the application.
 * @type {AppConfig}
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