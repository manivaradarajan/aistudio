// js/state.js
import { UI_STATUS } from "./constants.js";

/**
 * @private
 * The single source of truth for the application's state.
 */
const _state = {
  allTexts: [], // Holds only INTERNAL texts for the dropdown menu
  libraryData: [], // Holds the entire content of library.json
  aliasMap: new Map(), // Maps any alias/slug to its canonical library entry
  currentTextSlug: null,
  currentUpanishadData: null,
  dataMap: new Map(), // Map of unique ID -> data node for the current text
  currentLocation: {},
  userInitiatedClick: false,
  uiStatus: UI_STATUS.IDLE,
  navigationRequestId: 0,
};

/**
 * Returns a read-only snapshot of the current state.
 * @returns {object} A copy of the current state.
 */
export const getState = () => ({ ..._state });

// ... (getNewNavigationRequestId, getCurrentNavigationRequestId, etc. remain the same) ...
export function getNewNavigationRequestId() {
  return ++_state.navigationRequestId;
}
export const getCurrentNavigationRequestId = () => _state.navigationRequestId;
export const getCurrentUpanishadData = () => _state.currentUpanishadData;
export const getCurrentTextSlug = () => _state.currentTextSlug;
export const getNodeById = (id) => _state.dataMap.get(id);


// --- NEW AND MODIFIED FUNCTIONS ---

/**
 * Sets the full library data from library.json and builds the alias map for fast lookups.
 * @param {Array<object>} libraryData - The content of library.json
 */
export function setLibraryData(libraryData) {
  _state.libraryData = libraryData;
  _state.aliasMap.clear();
  libraryData.forEach(text => {
    // Map the canonical slug to the entry
    _state.aliasMap.set(text.slug, text);
    // Map all aliases to the same entry
    if (text.aliases) {
      text.aliases.forEach(alias => {
        _state.aliasMap.set(alias, text);
      });
    }
  });
}

/**
 * Retrieves a library text object by its canonical slug or any of its aliases.
 * @param {string} slugOrAlias - The slug or alias to look up.
 * @returns {object | undefined} The library text object.
 */
export const getTextFromLibrary = (slugOrAlias) => _state.aliasMap.get(slugOrAlias);


/**
 * Updates the list of all available INTERNAL texts for the dropdown.
 * @param {Array<object>} texts - The array of text manifests with isInternal: true.
 */
export function setAllTexts(texts) {
  _state.allTexts = texts;
}

// ... (setCurrentText, setCurrentLocation, etc. remain the same) ...
export function setCurrentText(slug, upanishadData, dataMap) {
  _state.currentTextSlug = slug;
  _state.currentUpanishadData = upanishadData;
  _state.dataMap = dataMap;
}
export function setCurrentLocation(location) {
  _state.currentLocation = location;
}
export function setUserInitiatedClick(wasUserClick) {
  _state.userInitiatedClick = wasUserClick;
}
export function setUiStatus(status) {
  _state.uiStatus = status;
}