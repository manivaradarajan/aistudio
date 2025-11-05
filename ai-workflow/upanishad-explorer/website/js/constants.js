// js/constants.js

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

export const UI_STATUS = {
  IDLE: "idle",
  LOADING: "loading",
  ERROR: "error",
};