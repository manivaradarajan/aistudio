// js/app.js

/**
 * @file This is the main entry point for the Upanishad Explorer application.
 * @module app
 */

import { DOM_SELECTORS, CONFIG } from "./constants.js";
import * as state from "./state.js";
import { cacheDomElements } from "./utils.js";
import { handleRouteChange } from "./router.js";
import { initMobileUI, openMobileOverlay, closeMobileOverlays } from "./ui/mobile.js";
import * as commonUI from "./ui/common.js";
import * as navUI from "./ui/navigator.js";
import * as contentUI from "./ui/content.js";
import * as events from "./events.js";
import "./types.js"; // Import JSDoc type definitions

/**
 * A cached map of frequently used DOM elements.
 * @type {Object.<string, HTMLElement>}
 */
let dom;

document.addEventListener("DOMContentLoaded", init);

/**
 * The main initialization function for the application.
 */
async function init() {
  dom = cacheDomElements(DOM_SELECTORS);
  initModules();
  addEventListeners();

  try {
    const [internalData, externalData] = await Promise.all([
      fetch(CONFIG.INTERNAL_MANIFEST).then(res => res.json()),
      fetch(CONFIG.EXTERNAL_MANIFEST).then(res => res.json())
    ]);

    const fullLibraryData = [...internalData, ...externalData];
    state.initializeLibrary(fullLibraryData);

    state.updateState({ allTexts: internalData });
    commonUI.populateTextSelector(internalData);

    const lastVisitedPath = localStorage.getItem('lastVisitedPath');
    if (lastVisitedPath) {
      window.location.hash = lastVisitedPath;
    }

    await handleRouteChange();

    // Dark Mode Initialization
    const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'true' || (savedDarkMode === null && prefersDarkMode)) {
      dom.body.classList.add('dark-mode');
      /** @type {HTMLInputElement} */ (dom.darkModeToggle).checked = true;
    }

    // Script and Language Initialization
    const savedScript = localStorage.getItem('script') || 'devanagari';
    const savedLanguage = localStorage.getItem('language') || 'both';
    state.updateState({ script: savedScript, language: savedLanguage });
    /** @type {HTMLSelectElement} */ (dom.scriptSelector).value = savedScript;
    /** @type {HTMLSelectElement} */ (dom.languageSelector).value = savedLanguage;

    // Font Size Initialization
    const savedFontSize = localStorage.getItem('fontSize') || '100';
    dom.body.style.fontSize = `${savedFontSize}%`;
    /** @type {HTMLInputElement} */ (dom.fontSizeSlider).value = savedFontSize;
    /** @type {HTMLElement} */ (dom.fontSizeValue).textContent = `${savedFontSize}%`;

    // Commentary Selection Initialization
    const savedCommentaries = JSON.parse(localStorage.getItem('selectedCommentaries')) || ['vedanta_desika'];
    state.updateState({ selectedCommentaries: savedCommentaries });
    dom.commentarySelectionContainer.querySelectorAll('input').forEach(input => {
      input.checked = savedCommentaries.includes(input.value);
    });

  } catch (error) {
    console.error("Initialization failed:", error);
    commonUI.showError("Failed to load application. Please refresh the page.");
  }
}

/**
 * Initializes all the UI and state modules.
 */
function initModules() {
  initMobileUI(dom);
  commonUI.initCommonUI(dom);
  navUI.initNavigator(dom);
  contentUI.initContent(dom);
}

/**
 * Adds all necessary event listeners for the application.
 */
function addEventListeners() {
  window.addEventListener("hashchange", handleRouteChange);
  dom.textSelector.addEventListener("change", events.handleTextChange);
  dom.refToggle.addEventListener("change", events.handleRefToggleChange);
  dom.navigatorContent.addEventListener("click", events.handleNavigatorClick);
  dom.mantraDisplay.addEventListener("click", events.handleMantraClick);
  dom.commentaryText.addEventListener("click", events.handleReferenceClick);
  dom.prevBtn.addEventListener("click", () => events.navigateArrows("prev"));
  dom.nextBtn.addEventListener("click", () => events.navigateArrows("next"));

  dom.mobileNavToggle.addEventListener("click", () => openMobileOverlay(/** @type {HTMLElement} */ (dom.navigatorPane)));
  dom.mobileNavClose.addEventListener("click", closeMobileOverlays);
  dom.mobileCommentaryClose.addEventListener("click", closeMobileOverlays);
  dom.mobileOverlay.addEventListener("click", closeMobileOverlays);

  // Settings Panel Listeners
  dom.settingsToggle.addEventListener("click", () => openMobileOverlay(/** @type {HTMLElement} */ (dom.settingsPanel)));
  dom.settingsClose.addEventListener("click", closeMobileOverlays);

  // Dark Mode Toggle
  dom.darkModeToggle.addEventListener('change', (e) => {
    if (/** @type {HTMLInputElement} */ (e.target).checked) {
      dom.body.classList.add('dark-mode');
      localStorage.setItem('darkMode', 'true');
    } else {
      dom.body.classList.remove('dark-mode');
      localStorage.setItem('darkMode', 'false');
    }
  });

  // Script and Language Selectors
  dom.scriptSelector.addEventListener('change', (e) => {
    const newScript = /** @type {HTMLSelectElement} */ (e.target).value;
    state.updateState({ script: newScript });
    localStorage.setItem('script', newScript);
    handleRouteChange(); // Re-render content with new script
  });

  dom.languageSelector.addEventListener('change', (e) => {
    const newLanguage = /** @type {HTMLSelectElement} */ (e.target).value;
    state.updateState({ language: newLanguage });
    localStorage.setItem('language', newLanguage);
    handleRouteChange(); // Re-render content with new language display
  });

  // Font Size Slider
  dom.fontSizeSlider.addEventListener('input', (e) => {
    const newSize = /** @type {HTMLInputElement} */ (e.target).value;
    dom.body.style.fontSize = `${newSize}%`;
    /** @type {HTMLElement} */ (dom.fontSizeValue).textContent = `${newSize}%`;
    localStorage.setItem('fontSize', newSize);
  });

  // Commentary Selection
  dom.commentarySelectionContainer.addEventListener('change', () => {
    const selectedCommentaries = Array.from(dom.commentarySelectionContainer.querySelectorAll('input:checked')).map(input => input.value);
    state.updateState({ selectedCommentaries });
    localStorage.setItem('selectedCommentaries', JSON.stringify(selectedCommentaries));
    handleRouteChange(); // Re-render content with new commentary selection
  });

  // Variant Modal Listeners
  dom.variantModalClose.addEventListener('click', () => dom.variantModal.style.display = 'none');
  window.addEventListener('click', (event) => {
    if (event.target == dom.variantModal) {
      dom.variantModal.style.display = 'none';
    }
  });

  dom.variantModalBody.addEventListener('change', (e) => {
    const target = /** @type {HTMLInputElement} */ (e.target);
    const itemId = target.dataset.itemId;
    const newVariant = target.value;

    const { selectedVariants } = state.getState();
    const newSelectedVariants = { ...selectedVariants, [itemId]: newVariant };
    state.updateState({ selectedVariants: newSelectedVariants });
    localStorage.setItem('selectedVariants', JSON.stringify(newSelectedVariants));

    dom.variantModal.style.display = 'none';
    handleRouteChange();
  });

  // Help Modal Listeners
  dom.helpButton.addEventListener('click', () => {
    dom.helpModalBody.innerHTML = `
      <h3>Key Features</h3>
      <ul>
        <li><b>Text Selection:</b> Use the dropdown at the top of the left panel to switch between different Upanishads.</li>
        <li><b>Navigation:</b> Click on a section in the left panel to navigate to it. Use the arrows at the top of the main panel to move between sections.</li>
        <li><b>Commentary:</b> Select one or more commentaries from the checkboxes in the right panel to view them. On mobile, tap the commentary section at the bottom to open it.</li>
        <li><b>Settings:</b> Click the gear icon in the top right to open the settings panel. Here you can change the script, language, font size, and toggle dark mode.</li>
        <li><b>Variant Readings:</b> If a verse has a variant reading, a 'ⓘ' badge will appear next to it. Click the badge to open a modal and select a different reading.</li>
      </ul>
    `;
    dom.helpModal.style.display = 'block';
  });
  dom.helpModalClose.addEventListener('click', () => dom.helpModal.style.display = 'none');
  window.addEventListener('click', (event) => {
    if (event.target == dom.helpModal) {
      dom.helpModal.style.display = 'none';
    }
  });

  document.body.addEventListener('click', (e) => {
    if (!e.target.classList.contains('footnote-ref')) {
      contentUI.hideTooltip();
    }
  });
}