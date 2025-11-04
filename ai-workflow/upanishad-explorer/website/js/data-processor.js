// js/data-processor.js

/**
 * Processes raw text data to add unique IDs and create a lookup map.
 * This is a crucial step to decouple the DOM from the data structure.
 * @param {object} rawData - The raw data loaded from a text's JSON file.
 * @param {string} textSlug - The slug of the text for ID generation.
 * @returns {{processedData: object, dataMap: Map<string, object>}}
 */
export function processTextData(rawData, textSlug) {
  const dataMap = new Map();
  const processedData = JSON.parse(JSON.stringify(rawData)); // Deep copy

  /**
   * Recursive helper to traverse the data tree and add metadata.
   * @param {Array<object>} nodes - The array of nodes to process.
   * @param {Array<string>} parentIdParts - The ID parts from the parent.
   * @param {Array<number>} parentNumberPath - The number path from the parent.
   */
  function traverse(nodes, parentIdParts, parentNumberPath) {
    if (!Array.isArray(nodes)) return;
    nodes.forEach((node, index) => {
      const idParts = [...parentIdParts, node.number];
      const id = idParts.join("-");

      // Add metadata to the node
      node.id = id;
      node.numberPath = [...parentNumberPath, node.number];
      node.indexPath = index; // Store original index for lookups

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
