/**
 * @file This file contains JSDoc type definitions for the core data structures used in the application.
 * These types provide a "schema" for the data, which helps with code completion, type checking, and overall code clarity.
 * @module types
 */

/**
 * Represents a single node in the hierarchical structure of an Upanishad text.
 * @typedef {object} UpanishadNode
 * @property {string} id - A unique identifier for the node (e.g., "kena-1-2").
 * @property {number} number - The number of the node within its level (e.g., 2).
 * @property {string} [name] - The name of the node, if applicable (e.g., "Kena Upanishad").
 * @property {string} [text] - The text content of the node, if it is a leaf node.
 * @property {string} [commentary_text] - The commentary text associated with the node.
 * @property {Array<UpanishadNode>} [children] - An array of child nodes.
 * @property {string} [file] - The path to a file containing lazy-loadable children.
 * @property {Array<number>} numberPath - The path of numbers from the root to this node (e.g., [1, 2]).
 * @property {number} indexPath - The original index of the node within its parent's children array.
 */

/**
 * Represents an entry in the text library (either internal or external).
 * @typedef {object} LibraryEntry
 * @property {string} slug - The unique slug for the text (e.g., "kena").
 * @property {string} name - The full name of the text (e.g., "Kena Upanishad").
 * @property {string} file - The path to the main JSON file for the text.
 * @property {boolean} isInternal - A flag indicating whether the text is part of the main application content.
 * @property {Array<string>} [aliases] - An array of alternative names or slugs for the text.
 */

/**
 * Represents the global state of the application.
 * @typedef {object} AppState
 * @property {Array<LibraryEntry>} allTexts - A list of all available text manifests.
 * @property {Array<LibraryEntry>} libraryData - Data for the entire reference library.
 * @property {Map<string, LibraryEntry>} aliasMap - A map for quick lookup of library texts by slug or alias.
 * @property {string|null} currentTextSlug - The slug of the currently loaded Upanishad.
 * @property {object|null} currentUpanishadData - The full data object for the currently loaded Upanishad.
 * @property {Map<string, UpanishadNode>} dataMap - A map of all nodes in the current Upanishad, indexed by their ID.
 * @property {object} currentLocation - The current navigation location within the text.
 * @property {boolean} userInitiatedClick - A flag to indicate if a navigation event was triggered by a direct user click.
 * @property {Symbol} uiStatus - The current status of the UI (e.g., IDLE, LOADING).
 * @property {number} navigationRequestId - A counter to track navigation requests.
 * @property {boolean} showExternalRefs - A flag to control the visibility of external reference links.
 */

// This file only contains type definitions, so it doesn't export anything.
