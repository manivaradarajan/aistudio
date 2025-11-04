// js/ui/navigator.js
import { CONFIG } from "../constants.js";
import { buildPathFromNode } from "../utils.js";
import * as state from "../state.js";

let dom;

export function initNavigator(domElements) {
  dom = domElements;
}

/**
 * Renders the entire navigation pane by starting the universal recursive process.
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
 * The single, universal, recursive function to build a navigation element.
 * It decides whether to create a link or an accordion based on the node's structure.
 * A node with children becomes an accordion. A node without children becomes a link.
 *
 * @param {object} node - The data node from the text's content tree.
 * @param {number} depth - The current depth in the structure (0-indexed).
 * @param {Array<string>} structureLevels - The text's structure_levels array.
 * @returns {HTMLElement} A list item (`<li>`) containing either an accordion or a link.
 */
function createNavElement(node, depth, structureLevels) {
  const li = document.createElement("li");

  // If a node has children, it is a structural container and should be an accordion.
  if (node.children && node.children.length > 0) {
    // --- This is an Accordion Level ---
    const details = document.createElement("details");
    details.className = "accordion-group";

    const summary = document.createElement("summary");
    const levelName = structureLevels[depth];
    const label = CONFIG.DEVANAGARI_LABELS[levelName] || levelName;
    summary.textContent = node.name || `${label} ${node.number}`;
    details.appendChild(summary);

    const innerUl = document.createElement("ul");
    node.children.forEach((childNode) => {
      // Recurse to the next level down.
      const childElement = createNavElement(
        childNode,
        depth + 1,
        structureLevels
      );
      innerUl.appendChild(childElement);
    });
    details.appendChild(innerUl);
    li.appendChild(details);
  } else {
    // --- This is a Link Level ---
    // If a node has no children, it's treated as a terminal navigation item (a leaf).
    // This creates a direct link to this content item.
    const link = document.createElement("a");
    const levelName = structureLevels[depth];
    const label = CONFIG.DEVANAGARI_LABELS[levelName] || levelName;
    const title = node.name || `${label} ${node.number}`;

    // The link should point to the content item itself.
    link.href = `#${buildPathFromNode(state.getCurrentTextSlug(), node)}`;

    // data-section-id is used for highlighting the active link. The logic finds
    // the most specific match, so setting this to the item's ID works correctly.
    link.dataset.sectionId = node.id;

    populateLinkWithPreview(link, node, title);
    li.appendChild(link);
  }

  return li;
}

// --- HELPER FUNCTIONS ---

function populateLinkWithPreview(link, item, title) {
  // The preview should come from the first actual text item in the section.
  const previewNode = item; // Since links are only for leaf nodes now.

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
    }
  } else {
    link.textContent = title;
  }
}

export function updateNavigatorState() {
  // FIX: Use querySelectorAll to robustly clear any existing active links.
  dom.navigatorContent
    .querySelectorAll("a.active")
    .forEach((el) => el.classList.remove("active"));

  const currentItemId = dom.mantraDisplay.querySelector(
    ".item-container.selected"
  )?.dataset.id;
  if (!currentItemId) return;

  const allLinks = dom.navigatorContent.querySelectorAll("a[data-section-id]");
  let activeLink = null;

  for (const link of allLinks) {
    const sectionId = link.dataset.sectionId;
    if (currentItemId.startsWith(sectionId)) {
      // Find the most specific link that contains the current item.
      // If we've already found a link, check if this new one is more specific (longer ID).
      if (
        !activeLink ||
        sectionId.length > activeLink.dataset.sectionId.length
      ) {
        activeLink = link;
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
