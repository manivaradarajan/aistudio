// js/ui/navigator.js

/**
 * @file This file handles the rendering and state management of the navigation pane (the table of contents).
 * @module navigator
 */

import { buildPathFromNode } from "../utils.js";
import * as state from "../state.js";
import "../types.js"; // Import JSDoc type definitions

/**
 * A cached map of DOM elements used by the module.
 * @type {Object.<string, HTMLElement>}
 */
let dom;

/**
 * Initializes the navigator module with essential DOM elements.
 * @param {Object.<string, HTMLElement>} domElements - A map of cached DOM elements.
 */
export function initNavigator(domElements) {
  dom = domElements;
}

/**
 * Renders the entire navigation tree based on the currently loaded Upanishad data.
 */
export function renderNavigator() {
  const upanishadData = state.getCurrentUpanishadData();
  if (!upanishadData) return;

  const { structure_levels, content } = upanishadData;
  dom.navigatorContent.innerHTML = "";
  const fragment = document.createDocumentFragment();

  const ul = document.createElement("ul");
  content.forEach((node) => {
    const navItem = createNavElement(node, 0, structure_levels);
    ul.appendChild(navItem);
  });

  fragment.appendChild(ul);
  dom.navigatorContent.appendChild(fragment);
}

/**
 * Recursively creates a navigation element (a list item) for a given node.
 * @param {UpanishadNode} node - The content node to create a navigation element for.
 * @param {number} depth - The current depth of the node in the hierarchy.
 * @param {Array<object|string>} structureLevels - An array defining the names of each level.
 * @returns {HTMLLIElement} The created list item element.
 */
function createNavElement(node, depth, structureLevels) {
  const li = document.createElement("li");

  const levelInfo = structureLevels[depth];
  let label = `Level ${depth}`;

  if (levelInfo && typeof levelInfo === 'object' && levelInfo.scriptNames) {
    label = levelInfo.scriptNames.devanagari || levelInfo.key;
  } else if (typeof levelInfo === 'string') {
    label = levelInfo;
  }

  if (node.children && node.children.length > 0) {
    const details = document.createElement("details");
    details.className = "accordion-group";

    const summary = document.createElement("summary");
    summary.textContent = node.name || `${label} ${node.number}`;
    details.appendChild(summary);

    const innerUl = document.createElement("ul");
    node.children.forEach((childNode) => {
      const childElement = createNavElement(childNode, depth + 1, structureLevels);
      innerUl.appendChild(childElement);
    });
    details.appendChild(innerUl);
    li.appendChild(details);
  } else {
    const link = document.createElement("a");
    const title = node.name || `${label} ${node.number}`;
    link.href = `#${buildPathFromNode(state.getCurrentTextSlug(), node)}`;
    link.dataset.sectionId = node.id;

    populateLinkWithPreview(link, node, title);
    li.appendChild(link);
  }

  return li;
}

/**
 * Populates a navigation link with a title and a text preview.
 * @param {HTMLAnchorElement} link - The anchor element to populate.
 * @param {UpanishadNode} item - The content item associated with the link.
 * @param {string} title - The title of the navigation item.
 */
function populateLinkWithPreview(link, item, title) {
  const previewNode = item;
  if (previewNode?.text) {
    const previewText = previewNode.text.trim().split("\n")[0];
    if (/\S/.test(previewText)) {
      const titleSpan = document.createElement("span");
      titleSpan.className = "nav-item-title";
      titleSpan.textContent = title + " - ";
      const previewSpan = document.createElement("span");
      previewSpan.className = "nav-item-preview";
      previewSpan.textContent = previewText;
      link.appendChild(titleSpan);
      link.appendChild(previewSpan);
    } else {
      link.textContent = title;
      link.classList.add("nav-item-title");
    }
  } else {
    link.textContent = title;
    link.classList.add("nav-item-title");
  }
}

/**
 * Updates the navigator's state to reflect the currently selected content item.
 */
export function updateNavigatorState() {
  dom.navigatorContent
    .querySelectorAll("a.active")
    .forEach((el) => el.classList.remove("active"));

  const currentItemId = /** @type {HTMLElement} */ (dom.mantraDisplay.querySelector(
    ".item-container.selected"
  ))?.dataset.id;
  if (!currentItemId) return;

  const allLinks = dom.navigatorContent.querySelectorAll("a[data-section-id]");
  /** @type {HTMLAnchorElement | null} */
  let activeLink = null;
  for (const link of allLinks) {
    const sectionId = /** @type {HTMLAnchorElement} */ (link).dataset.sectionId;
    if (currentItemId.startsWith(sectionId)) {
      if (
        !activeLink ||
        sectionId.length > activeLink.dataset.sectionId.length
      ) {
        activeLink = /** @type {HTMLAnchorElement} */ (link);
      }
    }
  }

  if (activeLink) {
    activeLink.classList.add("active");
    let parent = activeLink.closest("details");
    while (parent) {
      parent.open = true;
      parent = parent.parentElement.closest("details");
    }
  }
}