// js/api.js

/**
 * @file This file handles all network requests for the application, such as fetching text data and manifests.
 * It includes a mechanism to abort pending requests to prevent race conditions.
 * @module api
 */

import { CONFIG } from "./constants.js";
import "./types.js"; // Import JSDoc type definitions

/**
 * A controller to manage and abort fetch requests.
 * @type {AbortController}
 */
let fetchController;

/**
 * Fetches a JSON resource with support for aborting previous, unfinished requests.
 * @param {string} url - The URL of the JSON resource to fetch.
 * @returns {Promise<any>} A promise that resolves to the parsed JSON response.
 * @throws {Error} Throws an error if the network response is not ok, or if the fetch is aborted.
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
  const response = await fetch(filePath);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status} for ${filePath}`);
  }
  return response.json();
}
