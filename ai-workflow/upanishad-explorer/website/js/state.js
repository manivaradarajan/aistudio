import { UI_STATUS } from "./constants.js";

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

export const getState = () => ({ ..._state });
export function getNewNavigationRequestId() { return ++_state.navigationRequestId; }
export const getCurrentNavigationRequestId = () => _state.navigationRequestId;
export const getCurrentUpanishadData = () => _state.currentUpanishadData;
export const getCurrentTextSlug = () => _state.currentTextSlug;
export const getNodeById = (id) => _state.dataMap.get(id);

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

export const getTextFromLibrary = (slugOrAlias) => _state.aliasMap.get(slugOrAlias);

export function setAllTexts(texts) {
  _state.allTexts = texts;
}
export function setCurrentText(slug, upanishadData, dataMap) {
  _state.currentTextSlug = slug;
  _state.currentUpanishadData = upanishadData;
  _state.dataMap = dataMap;
}
export function setCurrentLocation(location) { _state.currentLocation = location; }
export function setUserInitiatedClick(wasUserClick) { _state.userInitiatedClick = wasUserClick; }
export function setUiStatus(status) { _state.uiStatus = status; }

/**
 * Sets the visibility state for external reference links.
 * @param {boolean} shouldShow - True to show, false to hide/disable.
 */
export function setShowExternalRefs(shouldShow) {
  _state.showExternalRefs = shouldShow;
}