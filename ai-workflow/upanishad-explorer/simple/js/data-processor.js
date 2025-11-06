// js/data-processor.js

/**
 * @file This file contains the data processing logic for the application.
 * Its primary responsibility is to take the raw JSON data for a text and enrich it with metadata
 * that is essential for the application's functionality, such as unique IDs and lookup maps.
 * @module data-processor
 */

import "./types.js"; // Import JSDoc type definitions

/**
 * Processes raw text data to add unique IDs, create a lookup map, and add other useful metadata.
 * @param {object} rawData - The raw data object loaded from a text's JSON file.
 * @param {string} textSlug - The slug of the text, used to create globally unique IDs.
 * @returns {{processedData: object, dataMap: Map<string, UpanishadNode>}} An object containing the processed data
 * and a Map for quick lookup of any node by its ID.
 */
export function processTextData(rawData, textSlug) {
  const dataMap = new Map();
  const processedData = JSON.parse(JSON.stringify(rawData));

  /**
   * A recursive helper function to traverse the hierarchical data tree and add metadata to each node.
   * @param {Array<UpanishadNode>} nodes - The array of content nodes to process.
   * @param {Array<string>} parentIdParts - The parts of the ID from the parent node.
   * @param {Array<number>} parentNumberPath - The path of numbers from the root to the parent.
   */
  function traverse(nodes, parentIdParts, parentNumberPath) {
    if (!Array.isArray(nodes)) return;

    nodes.forEach((node, index) => {
      const idParts = [...parentIdParts, node.number];
      const id = idParts.join("-");

      node.id = id;
      node.numberPath = [...parentNumberPath, node.number];
      node.indexPath = index;

      dataMap.set(id, node);

      if (node.children) {
        traverse(node.children, idParts, node.numberPath);
      }
    });
  }

  const initialIdParts = [textSlug];
  traverse(processedData.content, initialIdParts, []);

  return { processedData, dataMap };
}

/**
 * Retrieves the transformed text for a given script from a content object.
 * @param {object} content - The content object containing different script versions.
 * @param {string} script - The desired script (eg., 'devanagari', 'roman', 'kannada').
 * @returns {string} The text in the specified script, or an empty string if not found.
 */
export function getTransformedText(content, script) {
  if (content && content.sanskrit && content.sanskrit[script]) {
    return content.sanskrit[script];
  }
  return '';
}
