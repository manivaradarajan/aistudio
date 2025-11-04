// app.js - Upanishad Explorer (Generalized and Robust)

// --- Application State ---
const state = {
  allTexts: [],
  currentText: null,
  currentUpanishadData: null,
  currentLocation: {},
  userInitiatedClick: false, // Track if click was from user interaction
  sectionCache: new Map(), // Cache for loaded section files
  loadingSection: false, // Track if a section is currently loading
};

// --- DOM References (Cached at initialization) ---
const dom = {
  body: document.body,
  textSelector: null,
  navigatorPane: null,
  commentaryPane: null,
  navigatorContent: null,
  contentTitle: null,
  mantraDisplay: null,
  commentaryText: null,
  mobileNavToggle: null,
  mobileNavClose: null,
  mobileCommentaryClose: null,
  mobileOverlay: null,
  prevBtn: null,
  nextBtn: null,
};

// --- Constants ---
const CONFIG = {
  TEXTS_MANIFEST: "texts.json",
  MOBILE_BREAKPOINT: 800,
  SPLIT_CONFIG: {
    sizes: [25, 45, 30],
    minSize: [200, 300, 300],
    gutterSize: 2,
    cursor: "col-resize",
  },
  DEVANAGARI_LABELS: {
    Anuvaka: "अनुवाकः",
    Mantra: "मन्त्रः",
    Khanda: "खण्डः",
    Valli: "वल्ली",
    Mundaka: "मुण्डकः",
    Adhyaya: "अध्यायः",
    Brahmana: "ब्राह्मणम्",
  },
};

// --- Main Initialization ---
document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheDomReferences();
  addEventListeners();

  try {
    state.allTexts = await loadTextsManifest();
    populateTextSelector();
    await handleRouteChange();
  } catch (error) {
    console.error("Initialization failed:", error);
    showError("Failed to load application. Please refresh the page.");
  }
}

function cacheDomReferences() {
  const elements = {
    body: document.body,
    textSelector: "text-selector",
    navigatorPane: "nav-pane",
    commentaryPane: "commentary-pane",
    navigatorContent: "navigator-content",
    contentTitle: "content-title",
    mantraDisplay: "mantra-display",
    commentaryText: "commentary-text",
    mobileNavToggle: "mobile-nav-toggle",
    mobileNavClose: "mobile-nav-close",
    mobileCommentaryClose: "mobile-commentary-close",
    mobileOverlay: "mobile-overlay",
    prevBtn: "prev-section",
    nextBtn: "next-section",
  };

  for (const [key, value] of Object.entries(elements)) {
    if (key === "body") {
      dom[key] = value;
    } else {
      dom[key] = document.getElementById(value);
    }
  }
}

async function loadTextsManifest() {
  const response = await fetch(CONFIG.TEXTS_MANIFEST);
  if (!response.ok) {
    throw new Error(`Could not load ${CONFIG.TEXTS_MANIFEST} manifest.`);
  }
  return response.json();
}

function showError(message) {
  if (dom.contentTitle) dom.contentTitle.textContent = "Error";
  if (dom.mantraDisplay)
    dom.mantraDisplay.innerHTML = `<p style="padding: 2rem; text-align: center; color: var(--text-color-muted);">${message}</p>`;
}

function showLoading(message = "Loading...") {
  if (dom.mantraDisplay)
    dom.mantraDisplay.innerHTML = `<p style="padding: 2rem; text-align: center; color: var(--text-color-muted);">${message}</p>`;
}

// --- Central Router ---
async function handleRouteChange() {
  const pathParts = parseHashPath();
  const textSlug = pathParts[0] || state.allTexts[0]?.slug;
  const targetText = findTextBySlug(textSlug);

  if (!targetText) {
    handleInvalidRoute(textSlug);
    return;
  }

  if (state.currentText?.file !== targetText.file) {
    await loadText(targetText);
  }

  const location = parseLocationFromPath(pathParts);
  await loadSection(location);
  selectItemFromUrl(pathParts);
}

function parseHashPath() {
  return window.location.hash.slice(1).split("/").filter(Boolean);
}

function findTextBySlug(slug) {
  return state.allTexts.find((t) => t.slug === slug);
}

function handleInvalidRoute(slug) {
  console.error(`Text with slug '${slug}' not found.`);
  const fallbackSlug = state.allTexts[0]?.slug;
  if (fallbackSlug) window.location.hash = `/${fallbackSlug}`;
}

function parseLocationFromPath(pathParts) {
  const navLevels = state.currentUpanishadData.structure_levels.slice(0, -1);
  const location = {};
  let dataTraversal = state.currentUpanishadData.content;

  for (let i = 0; i < navLevels.length; i++) {
    const urlNumber = parseInt(pathParts[i + 1], 10);
    const index = findIndexByNumber(
      dataTraversal,
      isNaN(urlNumber) ? null : urlNumber
    );
    location[`level${i}`] = index;
    if (!dataTraversal || !dataTraversal[index]) break;
    dataTraversal = dataTraversal[index]?.children;
  }
  return location;
}

function findIndexByNumber(array, number) {
  if (number === null) return 0;
  if (!array) return 0;
  const foundIndex = array.findIndex((item) => item.number === number);
  return foundIndex !== -1 ? foundIndex : 0;
}

function selectItemFromUrl(pathParts) {
  const navLevels = state.currentUpanishadData.structure_levels;
  const leafUrlNumber = parseInt(pathParts[navLevels.length], 10);
  const itemToSelect = findItemToSelect(leafUrlNumber);

  if (itemToSelect) {
    const showMobilePane = state.userInitiatedClick && isMobileView();
    showItemDetails(itemToSelect, showMobilePane);
    state.userInitiatedClick = false;
  }
}

function findItemToSelect(leafUrlNumber) {
  const allItems = dom.mantraDisplay.querySelectorAll(".item-container");
  if (isNaN(leafUrlNumber)) return allItems[0];
  for (const item of allItems) {
    if (parseInt(item.dataset.number, 10) === leafUrlNumber) return item;
  }
  return allItems[0];
}

function isMobileView() {
  return window.innerWidth <= CONFIG.MOBILE_BREAKPOINT;
}

// --- Text Loading ---
function populateTextSelector() {
  dom.textSelector.innerHTML = "";
  state.allTexts.forEach((text) => {
    const option = document.createElement("option");
    option.value = text.file;
    option.textContent = text.name;
    dom.textSelector.appendChild(option);
  });
}

function navigateTo(path) {
  if (window.location.hash !== `#${path}`) window.location.hash = path;
}

async function loadText(textObject) {
  try {
    const response = await fetch(textObject.file);
    if (!response.ok) throw new Error(`Failed to fetch ${textObject.file}`);
    state.currentUpanishadData = await response.json();
    state.currentText = textObject;
    dom.textSelector.value = textObject.file;
    state.sectionCache.clear();
    await renderNavigator(); // MADE ASYNC
    initializeSplitPanes();
  } catch (error) {
    console.error(`Error loading text from ${textObject.file}:`, error);
    showError("Failed to load text. Please try again.");
  }
}

function initializeSplitPanes() {
  if (!window.Split || isMobileView()) return;
  document.querySelectorAll(".gutter").forEach((g) => g.remove());
  window.Split(
    ["#nav-pane", "#main-pane", "#commentary-pane"],
    CONFIG.SPLIT_CONFIG
  );
}

// --- Lazy Loading Support ---
function isLazyNode(node) {
  return node && typeof node.file === "string" && !node.children;
}

async function loadLazyNode(node) {
  const cacheKey = node.file;
  if (state.sectionCache.has(cacheKey)) return state.sectionCache.get(cacheKey);
  try {
    const response = await fetch(node.file);
    if (!response.ok) throw new Error(`Failed to fetch section: ${node.file}`);
    const data = await response.json();
    state.sectionCache.set(cacheKey, data.children);
    return data.children;
  } catch (error) {
    console.error(`Error loading lazy section from ${node.file}:`, error);
    throw error;
  }
}

async function ensureNodeLoaded(node) {
  if (isLazyNode(node)) {
    const children = await loadLazyNode(node);
    node.children = children;
    delete node.file;
  }
  return node;
}

// --- GENERIC Navigator Rendering ---
async function renderNavigator() {
  // MADE ASYNC
  const { structure_levels, content } = state.currentUpanishadData;
  dom.navigatorContent.innerHTML = "";
  const fragment = document.createDocumentFragment();

  if (structure_levels.length <= 1) {
    // Flat list (e.g., Isavasya)
    renderFlatNavigator(content, fragment);
  } else {
    // Hierarchical list
    await renderHierarchicalNavigator(content, fragment, structure_levels); // MADE ASYNC
  }
  dom.navigatorContent.appendChild(fragment);
}

function renderFlatNavigator(nodes, parentElement) {
  const ul = document.createElement("ul");
  nodes.forEach((leaf, index) => {
    const listItem = document.createElement("li");
    const link = document.createElement("a");
    const leafLevelName = state.currentUpanishadData.structure_levels[0];
    const label = CONFIG.DEVANAGARI_LABELS[leafLevelName] || leafLevelName;
    const title = leaf.name || `${label} ${leaf.number}`;

    link.href = `#/${state.currentText.slug}/${leaf.number}`;
    populateLinkWithPreview(link, leaf, title);
    link.dataset.level0 = index;

    listItem.appendChild(link);
    ul.appendChild(listItem);
  });
  parentElement.appendChild(ul);
}

async function renderHierarchicalNavigator(
  nodes,
  parentElement,
  structureLevels
) {
  // MADE ASYNC
  for (const [topIndex, topItem] of nodes.entries()) {
    // Use for...of to support await
    const details = await createAccordionGroup(
      topItem,
      topIndex,
      structureLevels,
      [topItem.number]
    ); // MADE ASYNC
    parentElement.appendChild(details);
  }
}

async function createAccordionGroup(
  node,
  index,
  structureLevels,
  pathNumbers,
  currentLevel = 0
) {
  // MADE ASYNC
  // FIX: Ensure lazy-loaded data is available before rendering children.
  await ensureNodeLoaded(node);

  const details = document.createElement("details");
  details.className = "accordion-group";
  details[`dataset`][`level${currentLevel}`] = index;

  const summary = document.createElement("summary");
  const levelName = structureLevels[currentLevel];
  const label = CONFIG.DEVANAGARI_LABELS[levelName] || levelName;
  summary.textContent = node.name || `${label} ${node.number}`;
  details.appendChild(summary);

  const ul = document.createElement("ul");
  const children = node.children || [];
  const linkLevel = structureLevels.length - 2;

  // FIX: This loop correctly distinguishes between children that are links and children that are more accordions.
  for (const [childIndex, childNode] of children.entries()) {
    const childLevel = currentLevel + 1;
    // Stop if we are at the content level (e.g., Mantra), which shouldn't be in the navigator.
    if (childLevel > linkLevel) continue;

    const newPathNumbers = [...pathNumbers, childNode.number];
    const li = document.createElement("li");

    if (childLevel === linkLevel) {
      // This child is a final navigation link (e.g., a Brahmana or Anuvaka).
      const link = document.createElement("a");
      const childLevelName = structureLevels[childLevel];
      const childLabel =
        CONFIG.DEVANAGARI_LABELS[childLevelName] || childLevelName;
      const title = childNode.name || `${childLabel} ${childNode.number}`;
      link.href = `#/${state.currentText.slug}/${newPathNumbers.join("/")}`;

      // For preview text, we must load the child node if it's lazy.
      await ensureNodeLoaded(childNode);
      populateLinkWithPreview(link, getFirstDescendantLeaf(childNode), title);

      // Data attributes for state management.
      link.dataset[`level${currentLevel}`] = index;
      link.dataset[`level${childLevel}`] = childIndex;

      li.appendChild(link);
    } else {
      // childLevel < linkLevel
      // This child is another accordion level. Recurse.
      const nestedAccordion = await createAccordionGroup(
        childNode,
        childIndex,
        structureLevels,
        newPathNumbers,
        childLevel
      );
      li.appendChild(nestedAccordion);
    }
    ul.appendChild(li);
  }

  details.appendChild(ul);
  return details;
}

// Helper to find the first leaf node in a hierarchy for previews.
function getFirstDescendantLeaf(node) {
  if (!node) return null;
  if (node.text !== undefined) return node;

  // FIX: If children are lazy-loaded, we can't get a preview synchronously.
  // The caller function (createAccordionGroup) now ensures nodes are loaded before calling this.
  if (isLazyNode(node)) return null;

  if (node.children && node.children.length > 0) {
    return getFirstDescendantLeaf(node.children[0]);
  }
  return null;
}

function populateLinkWithPreview(link, item, title) {
  // Use the item's own text for preview if it exists (for flat structures).
  const previewNode = item || getFirstDescendantLeaf(item);
  if (previewNode?.text) {
    const previewText = previewNode.text.trim().split("\n")[0]; // Use only first line for preview
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

// --- Section Loading ---
async function loadSection(location) {
  if (state.loadingSection) return;
  state.loadingSection = true;
  state.currentLocation = location;

  try {
    const { titleParts, dataToRender } = await getSectionData(location);
    if (dataToRender) {
      renderSectionItems(dataToRender, location);
      dom.contentTitle.textContent = titleParts.join(" - ");
    }
    updateUiState();
  } catch (error) {
    console.error("Error loading section:", error);
    showError("Failed to load section. Please try again.");
  } finally {
    state.loadingSection = false;
  }
}

async function getSectionData(location) {
  const { structure_levels, content, text_name } = state.currentUpanishadData;
  const navLevels = structure_levels.slice(0, -1);
  let titleParts = [text_name];
  let dataToRender = content;

  for (let i = 0; i < navLevels.length; i++) {
    const index = location[`level${i}`];
    if (index === undefined) break;
    dataToRender = dataToRender[index];
    if (isLazyNode(dataToRender)) {
      showLoading("Loading section...");
      await ensureNodeLoaded(dataToRender);
    }
    titleParts.push(
      dataToRender.name || `${structure_levels[i]} ${dataToRender.number}`
    );
    dataToRender = dataToRender.children;
  }
  return { titleParts, dataToRender };
}

function renderSectionItems(dataToRender, location) {
  const dataArray = Array.isArray(dataToRender)
    ? dataToRender
    : dataToRender
    ? dataToRender.children
    : null;
  if (!dataArray) {
    dom.mantraDisplay.innerHTML = "";
    return;
  }

  const fragment = document.createDocumentFragment();
  const levelDepth = Object.keys(location).length;

  dataArray.forEach((item, index) => {
    const itemContainer = createItemContainer(
      item,
      location,
      levelDepth,
      index
    );
    fragment.appendChild(itemContainer);
  });

  dom.mantraDisplay.innerHTML = "";
  dom.mantraDisplay.appendChild(fragment);
}

function createItemContainer(item, location, levelDepth, index) {
  const container = document.createElement("div");
  container.className = "item-container";
  const itemPath = { ...location, [`level${levelDepth}`]: index };
  Object.entries(itemPath).forEach(([key, value]) => {
    container.dataset[key] = value;
  });
  container.dataset.number = item.number;

  const numberEl = document.createElement("p");
  numberEl.className = "item-number";
  numberEl.textContent = item.number;

  const textEl = document.createElement("p");
  textEl.className = "item-text";
  textEl.textContent = item.text;

  container.appendChild(numberEl);
  container.appendChild(textEl);
  return container;
}

// --- Item Selection & Commentary ---
function showItemDetails(itemContainer, showMobilePane = true) {
  dom.mantraDisplay.querySelector(".selected")?.classList.remove("selected");
  itemContainer.classList.add("selected");
  itemContainer.scrollIntoView({ behavior: "smooth", block: "center" });

  const itemData = getItemData(itemContainer);
  if (itemData) {
    updateUrlFromContainer(itemContainer);
    renderCommentary(itemData);
  }

  if (showMobilePane) openMobileOverlay(dom.commentaryPane);
}

function getItemData(itemContainer) {
  let dataToFind = state.currentUpanishadData.content;
  for (let i = 0; i < state.currentUpanishadData.structure_levels.length; i++) {
    const index = itemContainer.dataset[`level${i}`];
    if (index === undefined) break;
    dataToFind = dataToFind[parseInt(index)];
    if (
      dataToFind &&
      i < state.currentUpanishadData.structure_levels.length - 1
    ) {
      dataToFind = dataToFind.children;
    }
  }
  return dataToFind;
}

function updateUrlFromContainer(itemContainer) {
  const newPath = buildPathFromContainer(itemContainer);
  if (window.location.hash !== `#${newPath}`) {
    history.replaceState(null, "", `#${newPath}`);
  }
}

function renderCommentary(itemData) {
  dom.commentaryText.innerHTML = itemData.commentary_text
    ? marked.parse(itemData.commentary_text)
    : "<p>No commentary available.</p>";
}

// --- UI State Management ---
function updateUiState() {
  updateActiveNavigatorLink();
  updateAccordionState();
  updateArrowButtons();
}

function updateActiveNavigatorLink() {
  dom.navigatorContent.querySelector("a.active")?.classList.remove("active");
  const path = window.location.hash;
  let newLink = dom.navigatorContent.querySelector(`a[href="${path}"]`);
  if (!newLink) {
    const sectionPath = path.slice(0, path.lastIndexOf("/"));
    newLink = dom.navigatorContent.querySelector(`a[href^="${sectionPath}"]`);
  }
  newLink?.classList.add("active");
}

function updateAccordionState() {
  document.querySelectorAll(".accordion-group[open]").forEach((el) => {
    el.open = false;
  });

  let path = [];
  for (
    let i = 0;
    i < state.currentUpanishadData.structure_levels.length - 1;
    i++
  ) {
    const levelIndex = state.currentLocation[`level${i}`];
    if (levelIndex === undefined) break;
    path.push(`[data-level${i}="${levelIndex}"]`);
    const selector = path.join(" ");
    const accordion = dom.navigatorContent.querySelector(selector);
    if (accordion && accordion.tagName === "DETAILS") {
      accordion.open = true;
    }
  }
}

// --- Event Listeners ---
function addEventListeners() {
  window.addEventListener("hashchange", handleRouteChange);
  dom.textSelector.addEventListener("change", handleTextChange);
  dom.navigatorContent.addEventListener("click", handleNavigatorClick);
  dom.mantraDisplay.addEventListener("click", handleMantraClick);
  dom.prevBtn.addEventListener("click", () => navigateArrows("prev"));
  dom.nextBtn.addEventListener("click", () => navigateArrows("next"));
  dom.mobileNavToggle.addEventListener("click", () =>
    openMobileOverlay(dom.navigatorPane)
  );
  dom.mobileNavClose.addEventListener("click", closeMobileOverlays);
  dom.mobileCommentaryClose.addEventListener("click", closeMobileOverlays);
  dom.mobileOverlay.addEventListener("click", closeMobileOverlays);
}

function handleTextChange(e) {
  const newText = state.allTexts.find((t) => t.file === e.target.value);
  if (newText) window.location.hash = `/${newText.slug}`;
}

function handleNavigatorClick(e) {
  if (e.target.closest("a")) closeMobileOverlays();
}

function handleMantraClick(e) {
  const container = e.target.closest(".item-container");
  if (!container) return;
  const newPath = buildPathFromContainer(container);
  const newHash = `#${newPath}`;
  if (window.location.hash === newHash && isMobileView()) {
    showItemDetails(container, true);
  } else {
    state.userInitiatedClick = true;
    navigateTo(newPath);
  }
}

// --- Arrow Navigation ---
function navigateArrows(direction) {
  const { prev, next } = getAdjacentSections();
  const target = direction === "prev" ? prev : next;
  if (target) navigateTo(buildPathFromLocation(target));
}

function buildPathFromLocation(location) {
  const textSlug = state.currentText.slug;
  const navLevels = state.currentUpanishadData.structure_levels.slice(0, -1);
  const pathNumbers = [];
  let dataTraversal = state.currentUpanishadData.content;
  for (let i = 0; i < navLevels.length; i++) {
    const index = location[`level${i}`];
    if (!dataTraversal || !dataTraversal[index]) break;
    const item = dataTraversal[index];
    pathNumbers.push(item.number);
    dataTraversal = item.children;
  }
  return `/${textSlug}/${pathNumbers.join("/")}`;
}

function buildPathFromContainer(container) {
  const textSlug = state.currentText.slug;
  const levels = state.currentUpanishadData.structure_levels;
  const pathParts = [textSlug];
  let dataNode = state.currentUpanishadData.content;
  for (let i = 0; i < levels.length; i++) {
    const index = container.dataset[`level${i}`];
    if (index === undefined) break;
    dataNode = dataNode[parseInt(index)];
    pathParts.push(dataNode.number);
    if (dataNode && i < levels.length - 1) dataNode = dataNode.children;
  }
  return `/${pathParts.join("/")}`;
}

// --- Mobile UI ---
function openMobileOverlay(pane) {
  pane.classList.add("active");
  dom.mobileOverlay.classList.add("active");
  dom.body.classList.add("mobile-overlay-active");
}

function closeMobileOverlays() {
  dom.navigatorPane.classList.remove("active");
  dom.commentaryPane.classList.remove("active");
  dom.mobileOverlay.classList.remove("active");
  dom.body.classList.remove("mobile-overlay-active");
}

// --- GENERIC Arrow Button State ---
function getNodesAtLevel(level, pathIndices) {
  let nodes = state.currentUpanishadData.content;
  for (let i = 0; i < level; i++) {
    if (!nodes || !nodes[pathIndices[i]]) return [];
    nodes = nodes[pathIndices[i]].children;
  }
  return nodes || [];
}

function updateArrowButtons() {
  const { prev, next } = getAdjacentSections();
  dom.prevBtn.disabled = !prev;
  dom.nextBtn.disabled = !next;
}

function getAdjacentSections() {
  const navLevels = state.currentUpanishadData.structure_levels.slice(0, -1);
  if (navLevels.length === 0) return { prev: null, next: null };

  const currentLocation = { ...state.currentLocation };
  const maxLevels = navLevels.length;

  const calculate = (direction) => {
    const newLocation = { ...currentLocation };
    for (let i = maxLevels - 1; i >= 0; i--) {
      const parentPathIndices = Object.values(newLocation).slice(0, i);
      const siblings = getNodesAtLevel(i, parentPathIndices);
      const currentIndex = newLocation[`level${i}`];

      if (direction === "next") {
        if (currentIndex < siblings.length - 1) {
          newLocation[`level${i}`]++;
          for (let j = i + 1; j < maxLevels; j++) newLocation[`level${j}`] = 0;
          return newLocation;
        }
      } else {
        // prev
        if (currentIndex > 0) {
          newLocation[`level${i}`]--;
          for (let j = i + 1; j < maxLevels; j++) {
            const newParentPath = Object.values(newLocation).slice(0, j);
            const newSiblings = getNodesAtLevel(j, newParentPath);
            newLocation[`level${j}`] = newSiblings.length - 1;
          }
          return newLocation;
        }
      }
    }
    return null; // Reached beginning or end
  };

  return { prev: calculate("prev"), next: calculate("next") };
}
