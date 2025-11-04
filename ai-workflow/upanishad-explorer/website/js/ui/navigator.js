// js/ui/navigator.js
import { buildPathFromNode } from "../utils.js";
import * as state from "../state.js";

let dom;

export function initNavigator(domElements) {
  dom = domElements;
}

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

function createNavElement(node, depth, structureLevels) {
  const li = document.createElement("li");

  const levelInfo = structureLevels[depth];
  let label = `Level ${depth}`; // Default fallback

  // --- TRULY ROBUST FIX IS HERE ---
  // First, check if levelInfo exists, THEN check its properties.
  if (levelInfo && typeof levelInfo === 'object' && levelInfo.scriptNames) {
    // New format: { key: "Valli", scriptNames: { devanagari: "वल्ली" } }
    label = levelInfo.scriptNames.devanagari || levelInfo.key;
  } else if (typeof levelInfo === 'string') {
    // Old format fallback: "Valli"
    label = levelInfo;
  }
  // --- END FIX ---

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

// ... (rest of the file is unchanged) ...
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
    }
  } else {
    link.textContent = title;
  }
}
export function updateNavigatorState() {
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