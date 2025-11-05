// js/state.js

/**
 * @file This file manages the global state of the application.
 * It provides a centralized store for data, UI status, and user preferences.
 * @module state
 */

import { UI_STATUS } from "./constants.js";
import "./types.js"; // Import JSDoc type definitions

/**
 * The internal state object. It is not exported directly to prevent direct mutation.
 * @private
 * @type {AppState}
 */
const _state = {
  allTexts: [],
  libraryData: [],
  aliasMap: new Map(),
  currentTextSlug: null,
  currentUpanishadData: null,
  dataMap: new Map(),
  currentLocation: {},
  userInitiatedClick: false,
  uiStatus: UI_STATUS.IDLE,
  navigationRequestId: 0,
  showExternalRefs: false,
};

// --- State Getters ---

/**
 * Returns a shallow copy of the current state object to prevent direct mutation.
 * @returns {AppState} The current state.
 */
export const getState = () => ({ ..._state });

/**
 * Increments and returns a new, unique ID for a navigation request.
 * @returns {number} The new navigation request ID.
 */
export function getNewNavigationRequestId() { return ++_state.navigationRequestId; }

/**
 * Returns the ID of the most recent navigation request.
 * @returns {number} The current navigation request ID.
 */
export const getCurrentNavigationRequestId = () => _state.navigationRequestId;

/**
 * Returns the data for the currently loaded Upanishad.
 * @returns {object|null} The current Upanishad data.
 */
export const getCurrentUpanishadData = () => _state.currentUpanishadData;

/**
 * Returns the slug of the currently loaded text.
 * @returns {string|null} The current text slug.
 */
export const getCurrentTextSlug = () => _state.currentTextSlug;

/**
 * Retrieves a specific content node from the current Upanishad data by its ID.
 * @param {string} id - The ID of the node to retrieve.
 * @returns {UpanishadNode|undefined} The node object, or undefined if not found.
 */
export const getNodeById = (id) => _state.dataMap.get(id);

/**
 * Retrieves a text from the library by its slug or one of its aliases.
 * @param {string} slugOrAlias - The slug or alias to look up.
 * @returns {LibraryEntry|undefined} The library entry, or undefined if not found.
 */
export const getTextFromLibrary = (slugOrAlias) => _state.aliasMap.get(slugOrAlias);


// --- State Setters ---

/**
 * Sets the library data and builds the alias map for quick lookups.
 * @param {Array<LibraryEntry>} libraryData - The complete library data.
 */
export function setLibraryData(libraryData) {
  _state.libraryData = libraryData;
  _state.aliasMap.clear();
  libraryData.forEach(text => {
    _state.aliasMap.set(text.slug, text);
    if (text.aliases) {
      text.aliases.forEach(alias => {
        _state.aliasMap.set(alias, text);
      });
    }
  });
}

/**
 * Sets the list of all available text manifests.
 * @param {Array<LibraryEntry>} texts - The array of text manifests.
 */
export function setAllTexts(texts) {
  _state.allTexts = texts;
}

/**
 * Sets the currently active text, including its data and the node map.
 * @param {string} slug - The slug of the current text.
 * @param {object} upanishadData - The full data for the text.
 * @param {Map<string, UpanishadNode>} dataMap - The map of all nodes in the text.
 */
export function setCurrentText(slug, upanishadData, dataMap) {
  _state.currentTextSlug = slug;
  _state.currentUpanishadData = upanishadData;
  _state.dataMap = dataMap;
}

/**
 * Sets the current navigation location within the text.
 * @param {object} location - The location object.
 */
export function setCurrentLocation(location) { _state.currentLocation = location; }

/**
 * Sets a flag indicating whether the last action was a direct user click.
 * @param {boolean} wasUserClick - True if the action was a user click.
 */
export function setUserInitiatedClick(wasUserClick) { _state.userInitiatedClick = wasUserClick; }

/**
 * Sets the current UI status (e.g., IDLE, LOADING).
 * @param {UI_STATUS} status - The new UI status.
 */
export function setUiStatus(status) { _state.uiStatus = status; }

/**
 * Sets the visibility state for external reference links.
 * @param {boolean} shouldShow - True to show, false to hide/disable.
 */
export function setShowExternalRefs(shouldShow) {
  _state.showExternalRefs = shouldShow;
}