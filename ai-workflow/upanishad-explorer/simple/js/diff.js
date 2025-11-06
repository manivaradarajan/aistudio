// js/diff.js

/**
 * @file This file contains a simple diffing utility to highlight differences between two strings.
 * @module diff
 */

/**
 * Diffs two strings and returns an HTML string with the differences highlighted.
 * @param {string} oldStr - The old string.
 * @param {string} newStr - The new string.
 * @returns {string} An HTML string with the differences highlighted.
 */
export function diffStrings(oldStr, newStr) {
  const oldWords = oldStr.split(/\s+/);
  const newWords = newStr.split(/\s+/);
  let result = '';

  let i = 0;
  let j = 0;

  while (i < oldWords.length || j < newWords.length) {
    if (i < oldWords.length && j < newWords.length && oldWords[i] === newWords[j]) {
      result += oldWords[i] + ' ';
      i++;
      j++;
    } else {
      if (j < newWords.length) {
        result += `<ins>${newWords[j]}</ins> `;
        j++;
      }
      if (i < oldWords.length && (j >= newWords.length || oldWords[i] !== newWords[j - 1])) {
        result += `<del>${oldWords[i]}</del> `;
        i++;
      }
    }
  }

  return result;
}
