// js/api.js
import { CONFIG } from "./constants.js";

let fetchController;

/**
 * Fetches a JSON resource with abort signal support to prevent race conditions.
 * @param {string} url - The URL to fetch.
 * @returns {Promise<any>} The JSON response.
 * @throws {Error} If the fetch fails or is aborted.
 */
async function fetchWithAbort(url) {
  if (fetchController) {
    fetchController.abort();
  }
  fetchController = new AbortController();
  const signal = fetchController.signal;

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status} for ${url}`);
  }
  return response.json();
}

/**
 * Loads the main manifest of all available texts.
 * @returns {Promise<Array<object>>} A list of text manifest objects.
 */
export async function loadTextsManifest() {
  return fetchWithAbort(CONFIG.TEXTS_MANIFEST);
}

/**
 * Loads the main data file for a specific text.
 * @param {string} filePath - The path to the text's JSON file.
 * @returns {Promise<object>} The raw Upanishad data.
 */
export async function loadTextData(filePath) {
  return fetchWithAbort(filePath);
}

/**
 * Loads a lazy-loaded section of a text.
 * @param {string} filePath - The path to the section's JSON file.
 * @returns {Promise<object>} The raw section data.
 */
export async function loadLazySection(filePath) {
  // We use a separate fetch function here to not abort the main text loading
  const response = await fetch(filePath);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status} for ${filePath}`);
  }
  return response.json();
}
