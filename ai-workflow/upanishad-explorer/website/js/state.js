// js/state.js
import { UI_STATUS } from "./constants.js";

/**
 * @private
 * The single source of truth for the application's state.
 * Not exported directly to enforce state changes through setters.
 */
const _state = {
  allTexts: [],
  currentTextSlug: null,
  currentUpanishadData: null,
  dataMap: new Map(), // Map of unique ID -> data node
  currentLocation: {}, // { level0: index, level1: index, ... }
  userInitiatedClick: false,
  uiStatus: UI_STATUS.IDLE,
  navigationRequestId: 0, // <-- FIX: Added to track navigation requests
};

/**
 * Returns a read-only snapshot of the current state.
 * @returns {object} A copy of the current state.
 */
export const getState = () => ({ ..._state });

/**
 * Generates and returns a new, unique ID for a navigation request.
 * @returns {number}
 */
export function getNewNavigationRequestId() {
  return ++_state.navigationRequestId;
}

/**
 * Returns the ID of the most recent navigation request.
 * @returns {number}
 */
export const getCurrentNavigationRequestId = () => _state.navigationRequestId;

/**
 * Returns the full data object for the currently loaded Upanishad.
 * @returns {object | null}
 */
export const getCurrentUpanishadData = () => _state.currentUpanishadData;

/**
 * Returns the slug of the current text.
 * @returns {string | null}
 */
export const getCurrentTextSlug = () => _state.currentTextSlug;

/**
 * Retrieves a data node by its unique ID.
 * @param {string} id - The unique ID of the data node.
 * @returns {object | undefined} The data node.
 */
export const getNodeById = (id) => _state.dataMap.get(id);

/**
 * Updates the list of all available texts.
 * @param {Array<object>} texts - The array of text manifests.
 */
export function setAllTexts(texts) {
  _state.allTexts = texts;
}

/**
 * Sets the currently active text and its processed data.
 * @param {string} slug - The slug of the new current text.
 * @param {object} upanishadData - The processed data tree.
 * @param {Map<string, object>} dataMap - The lookup map for all nodes.
 */
export function setCurrentText(slug, upanishadData, dataMap) {
  _state.currentTextSlug = slug;
  _state.currentUpanishadData = upanishadData;
  _state.dataMap = dataMap;
}

/**
 * Sets the current navigation location within the text structure.
 * @param {object} location - An object with level indices, e.g., { level0: 0, level1: 2 }.
 */
export function setCurrentLocation(location) {
  _state.currentLocation = location;
}

/**
 * Sets a flag indicating if navigation was triggered by a direct user click.
 * @param {boolean} wasUserClick - True if user-initiated.
 */
export function setUserInitiatedClick(wasUserClick) {
  _state.userInitiatedClick = wasUserClick;
}

/**
 * Sets the overall UI status (e.g., 'loading', 'idle').
 * @param {string} status - One of the UI_STATUS values.
 */
export function setUiStatus(status) {
  _state.uiStatus = status;
}
