// js/state.js

/**
 * @file This file manages the global state of the application.
 * @module state
 */

import { UI_STATUS } from "./constants.js";
import "./types.js"; // Import JSDoc type definitions

/**
 * The internal state object.
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

/**
 * Updates the global state by merging the new state with the existing state.
 * @param {Partial<AppState>} newState - An object containing the state properties to update.
 */
export function updateState(newState) {
  Object.assign(_state, newState);
}

/**
 * Initializes the library data and builds the alias map for quick lookups.
 * @param {Array<LibraryEntry>} libraryData - The complete library data.
 */
export function initializeLibrary(libraryData) {
    const aliasMap = new Map();
    libraryData.forEach(text => {
        aliasMap.set(text.slug, text);
        if (text.aliases) {
            text.aliases.forEach(alias => {
                aliasMap.set(alias, text);
            });
        }
    });
    updateState({ libraryData, aliasMap });
}

// --- State Getters ---

/**
 * Returns a shallow copy of the current state object.
 * @returns {AppState} The current state.
 */
export const getState = () => ({ ..._state });

/**
 * Increments and returns a new, unique ID for a navigation request.
 * @returns {number} The new navigation request ID.
 */
export function getNewNavigationRequestId() {
  const newId = _state.navigationRequestId + 1;
  updateState({ navigationRequestId: newId });
  return newId;
}

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