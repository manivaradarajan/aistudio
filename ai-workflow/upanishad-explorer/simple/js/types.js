/**
 * @file This file contains JSDoc type definitions for the core data structures used in the application.
 * @module types
 */

/**
 * @typedef {Object.<string, (HTMLElement|string)>} DomSelectorMap
 * @property {HTMLElement} body
 * @property {string} textSelector
 * @property {string} navigatorPane
 * @property {string} commentaryPane
 * @property {string} mainPane
 * @property {string} navigatorContent
 * @property {string} contentTitle
 * @property {string} mantraDisplay
 * @property {string} commentaryText
 * @property {string} mobileNavToggle
 * @property {string} mobileNavClose
 * @property {string} mobileCommentaryClose
 * @property {string} mobileOverlay
 * @property {string} prevBtn
 * @property {string} nextBtn
 * @property {string} itemContainer
 * @property {string} activeNavLink
 * @property {string} selectedItem
 * @property {string} refToggle
 */

/**
 * @typedef {object} AppConfig
 * @property {string} INTERNAL_MANIFEST
 * @property {string} EXTERNAL_MANIFEST
 * @property {number} MOBILE_BREAKPOINT
 * @property {object} SPLIT_CONFIG
 * @property {number[]} SPLIT_CONFIG.sizes
 * @property {number[]} SPLIT_CONFIG.minSize
 * @property {number} SPLIT_CONFIG.gutterSize
 * @property {string} SPLIT_CONFIG.cursor
 */

/**
 * Represents a single node in the hierarchical structure of an Upanishad text.
 * @typedef {object} UpanishadNode
 * @property {string} id - A unique identifier for the node (e.g., "kena-1-2").
 * @property {number} number - The number of the node within its level (e.g., 2).
 * @property {string} [name] - The name of the node, if applicable (e.g., "Kena Upanishad").
 * @property {object} [content] - The content of the node.
 * @property {object} [content.sanskrit] - The Sanskrit content.
 * @property {string} [content.sanskrit.devanagari] - The Devanagari script.
 * @property {string} [content.sanskrit.roman] - The Roman script.
 * @property {string} [content.sanskrit.kannada] - The Kannada script.
 * @property {string} [content.english_translation] - The English translation.
 * @property {Array<object>} [commentaries] - An array of commentaries on the node.
 * @property {string} [commentaries.commentary_id] - The ID of the commentary (e.g., "vedanta_desika").
 * @property {object} [commentaries.sanskrit] - The Sanskrit commentary.
 * @property {string} [commentaries.sanskrit.devanagari] - The Devanagari script.
 * @property {string} [commentaries.sanskrit.roman] - The Roman script.
 * @property {string} [commentaries.sanskrit.kannada] - The Kannada script.
 * @property {string} [commentaries.english_translation] - The English translation of the commentary.
 * @property {object} [variants] - An object containing variant readings of the text.
 * @property {Array<object>} [footnotes] - An array of footnotes.
 * @property {string} [footnotes.id] - The ID of the footnote.
 * @property {Array<string>} [footnotes.applies_to] - An array of passage refs this footnote applies to.
 * @property {string} [footnotes.type] - The type of footnote.
 * @property {object} [footnotes.content] - The content of the footnote.
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