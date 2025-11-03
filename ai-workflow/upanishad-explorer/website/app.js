// app.js - Upanishad Explorer (Optimized with Multi-File Support)

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
  if (dom.contentTitle) {
    dom.contentTitle.textContent = message;
  }
  if (dom.mantraDisplay) {
    dom.mantraDisplay.innerHTML = `<p style="padding: 2rem; text-align: center; color: var(--text-color-muted);">${message}</p>`;
  }
}

function showLoading(message = "Loading...") {
  if (dom.mantraDisplay) {
    dom.mantraDisplay.innerHTML = `<p style="padding: 2rem; text-align: center; color: var(--text-color-muted);">${message}</p>`;
  }
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

  // Load text data if it's a new text
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
  if (fallbackSlug) {
    window.location.hash = `/${fallbackSlug}`;
  }
}

function parseLocationFromPath(pathParts) {
  const navLevels = state.currentUpanishadData.structure_levels.slice(0, -1);
  const location = {};
  let dataTraversal = state.currentUpanishadData.content;

  for (let i = 0; i < navLevels.length; i++) {
    const urlNumber = parseInt(pathParts[i + 1], 10) || 1;
    const index = findIndexByNumber(dataTraversal, urlNumber);
    location[`level${i}`] = index;
    dataTraversal = dataTraversal[index]?.children;
  }

  return location;
}

function findIndexByNumber(array, number) {
  const foundIndex = array.findIndex((item) => item.number === number);
  return foundIndex !== -1 ? foundIndex : 0;
}

function selectItemFromUrl(pathParts) {
  const navLevels = state.currentUpanishadData.structure_levels.slice(0, -1);
  const leafUrlNumber = parseInt(pathParts[navLevels.length + 1], 10);

  const itemToSelect = findItemToSelect(leafUrlNumber);

  if (itemToSelect) {
    // Show mobile pane only if this was triggered by a user click
    const showMobilePane = state.userInitiatedClick && isMobileView();
    showItemDetails(itemToSelect, showMobilePane);
    state.userInitiatedClick = false; // Reset flag
  }
}

function findItemToSelect(leafUrlNumber) {
  const allItems = dom.mantraDisplay.querySelectorAll(".item-container");

  if (isNaN(leafUrlNumber)) {
    return allItems[0]; // Default to first item
  }

  for (const item of allItems) {
    if (parseInt(item.dataset.number, 10) === leafUrlNumber) {
      return item;
    }
  }

  return allItems[0]; // Fallback to first item
}

function isMobileView() {
  return window.innerWidth <= CONFIG.MOBILE_BREAKPOINT;
}

// --- Text Loading ---
function populateTextSelector() {
  const fragment = document.createDocumentFragment();

  state.allTexts.forEach((text) => {
    const option = document.createElement("option");
    option.value = text.file;
    option.textContent = text.name;
    fragment.appendChild(option);
  });

  dom.textSelector.appendChild(fragment);
}

function navigateTo(path) {
  if (window.location.hash !== `#${path}`) {
    window.location.hash = path;
  }
}

async function loadText(textObject) {
  try {
    const response = await fetch(textObject.file);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${textObject.file}`);
    }

    state.currentUpanishadData = await response.json();
    state.currentText = textObject;
    dom.textSelector.value = textObject.file;

    // Clear section cache when loading new text
    state.sectionCache.clear();

    renderNavigator();
    initializeSplitPanes();
  } catch (error) {
    console.error(`Error loading text from ${textObject.file}:`, error);
    showError("Failed to load text. Please try again.");
  }
}

function initializeSplitPanes() {
  if (!window.Split || isMobileView()) {
    return;
  }

  // Remove existing gutters
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
  // Check cache first
  const cacheKey = node.file;
  if (state.sectionCache.has(cacheKey)) {
    return state.sectionCache.get(cacheKey);
  }

  try {
    const response = await fetch(node.file);
    if (!response.ok) {
      throw new Error(`Failed to fetch section: ${node.file}`);
    }

    const data = await response.json();

    // Cache the loaded data
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
    // Mutate the node to replace file reference with actual children
    node.children = children;
    delete node.file;
  }
  return node;
}

// --- Navigator Rendering ---
function renderNavigator() {
  const { structure_levels, content } = state.currentUpanishadData;

  dom.navigatorContent.innerHTML = "";

  if (structure_levels.length === 1) {
    renderFlatNavigator(content);
  } else if (structure_levels.length > 1) {
    renderHierarchicalNavigator(content, structure_levels[1]);
  }
}

function renderFlatNavigator(content) {
  const list = document.createElement("ul");
  const textSlug = state.currentText.slug;

  content.forEach((item, index) => {
    const listItem = document.createElement("li");
    const link = createNavigatorLink(item, textSlug, index);
    listItem.appendChild(link);
    list.appendChild(listItem);
  });

  dom.navigatorContent.appendChild(list);
}

function createNavigatorLink(
  item,
  textSlug,
  index,
  level0 = null,
  level1 = null
) {
  const link = document.createElement("a");
  const label = CONFIG.DEVANAGARI_LABELS[item.type] || item.type;

  link.href = `#/${textSlug}/${item.number}`;
  link.textContent = item.name || `${label} ${item.number}`;

  if (level0 !== null) link.dataset.level0 = level0;
  if (level1 !== null) link.dataset.level1 = level1;
  if (level0 === null && level1 === null) link.dataset.leafIndex = index;

  return link;
}

function renderHierarchicalNavigator(content, midLevelName) {
  const fragment = document.createDocumentFragment();
  const textSlug = state.currentText.slug;

  content.forEach((topItem, topIndex) => {
    const details = createAccordionGroup(
      topItem,
      topIndex,
      midLevelName,
      textSlug
    );
    fragment.appendChild(details);
  });

  dom.navigatorContent.appendChild(fragment);
}

function createAccordionGroup(topItem, topIndex, midLevelName, textSlug) {
  const details = document.createElement("details");
  details.className = "accordion-group";
  details.dataset.level0 = topIndex;

  const summary = document.createElement("summary");
  summary.textContent = topItem.name;
  details.appendChild(summary);

  const list = document.createElement("ul");

  // For lazy nodes, we still need to show navigation links
  // The children will be loaded when the section is accessed
  const children = topItem.children || [];

  if (children.length === 0 && isLazyNode(topItem)) {
    // This is a lazy node - create a placeholder link that goes to this section
    const listItem = document.createElement("li");
    const link = document.createElement("a");
    link.href = `#/${textSlug}/${topItem.number}`;
    link.textContent = "View Section";
    link.dataset.level0 = topIndex;
    listItem.appendChild(link);
    list.appendChild(listItem);
  } else {
    // Regular children rendering
    children.forEach((midItem, midIndex) => {
      const listItem = document.createElement("li");
      const link = document.createElement("a");
      const label = CONFIG.DEVANAGARI_LABELS[midLevelName] || midLevelName;

      link.href = `#/${textSlug}/${topItem.number}/${midItem.number}`;
      link.textContent = midItem.name || `${label} ${midItem.number}`;
      link.dataset.level0 = topIndex;
      link.dataset.level1 = midIndex;

      listItem.appendChild(link);
      list.appendChild(listItem);
    });
  }

  details.appendChild(list);
  return details;
}

// --- Section Loading ---
async function loadSection(location) {
  if (state.loadingSection) {
    return; // Prevent concurrent loads
  }

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

    // Check if this is a lazy node and load it
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
  if (!Array.isArray(dataToRender)) {
    dom.mantraDisplay.innerHTML = "";
    return;
  }

  const fragment = document.createDocumentFragment();
  const navLevels = state.currentUpanishadData.structure_levels.slice(0, -1);

  dataToRender.forEach((item, index) => {
    const itemContainer = createItemContainer(
      item,
      location,
      navLevels.length,
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

  // Store path data
  const itemPath = { ...location, [`level${levelDepth}`]: index };
  Object.entries(itemPath).forEach(([key, value]) => {
    container.dataset[key] = value;
  });
  container.dataset.number = item.number;

  // Create number element
  const numberEl = document.createElement("p");
  numberEl.className = "item-number";
  numberEl.textContent = item.number;

  // Create text element
  const textEl = document.createElement("p");
  textEl.className = "item-text";
  textEl.textContent = item.text;

  container.appendChild(numberEl);
  container.appendChild(textEl);

  return container;
}

// --- Item Selection & Commentary ---
function showItemDetails(itemContainer, showMobilePane = true) {
  // Update selection state
  const selected = dom.mantraDisplay.querySelector(".selected");
  if (selected) {
    selected.classList.remove("selected");
  }
  itemContainer.classList.add("selected");

  // Smooth scroll to item
  itemContainer.scrollIntoView({ behavior: "smooth", block: "center" });

  // Find and display item data
  const itemData = getItemData(itemContainer);

  if (itemData) {
    updateUrlFromContainer(itemContainer);
    renderCommentary(itemData);
  }

  // Show mobile pane if requested
  if (showMobilePane) {
    openMobileOverlay(dom.commentaryPane);
  }
}

function getItemData(itemContainer) {
  const levels = state.currentUpanishadData.structure_levels;
  let dataToFind = state.currentUpanishadData.content;

  for (let i = 0; i < levels.length; i++) {
    const index = itemContainer.dataset[`level${i}`];
    if (index === undefined) break;

    dataToFind = dataToFind[parseInt(index)];

    if (i < levels.length - 1) {
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
  if (itemData.commentary_text) {
    dom.commentaryText.innerHTML = marked.parse(itemData.commentary_text);
  } else {
    dom.commentaryText.innerHTML = "<p>No commentary available.</p>";
  }
}

// --- UI State Management ---
function updateUiState() {
  updateActiveNavigatorLink();
  updateAccordionState();
  updateArrowButtons();
}

function updateActiveNavigatorLink() {
  // Remove existing active class
  const activeLink = dom.navigatorContent.querySelector("a.active");
  if (activeLink) {
    activeLink.classList.remove("active");
  }

  // Find and activate current link
  const path = window.location.hash;
  let newLink = dom.navigatorContent.querySelector(`a[href="${path}"]`);

  // Fallback to section link if exact match not found
  if (!newLink) {
    const sectionPath = path.slice(0, path.lastIndexOf("/"));
    newLink = dom.navigatorContent.querySelector(`a[href="${sectionPath}"]`);
  }

  if (newLink) {
    newLink.classList.add("active");
  }
}

function updateAccordionState() {
  // Close all accordions
  document.querySelectorAll(".accordion-group").forEach((el) => {
    el.open = false;
  });

  // Open current accordion
  const { level0 } = state.currentLocation;
  if (level0 !== undefined) {
    const activeAccordion = dom.navigatorContent.querySelector(
      `[data-level0="${level0}"]`
    );
    if (activeAccordion) {
      activeAccordion.open = true;
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
  if (newText) {
    window.location.hash = `/${newText.slug}`;
  }
}

function handleNavigatorClick(e) {
  if (e.target.tagName === "A") {
    closeMobileOverlays();
  }
}

function handleMantraClick(e) {
  const container = e.target.closest(".item-container");
  if (container) {
    state.userInitiatedClick = true; // Set flag before navigation
    const newPath = buildPathFromContainer(container);
    navigateTo(newPath);
  }
}

// --- Arrow Navigation ---
function navigateArrows(direction) {
  const { prev, next } = getAdjacentSections();
  const target = direction === "prev" ? prev : next;

  if (!target) return;

  const path = buildPathFromLocation(target);
  navigateTo(path);
}

function buildPathFromLocation(location) {
  const textSlug = state.currentText.slug;
  const navLevels = state.currentUpanishadData.structure_levels.slice(0, -1);
  const pathNumbers = [];

  let dataTraversal = state.currentUpanishadData.content;

  for (let i = 0; i < navLevels.length; i++) {
    const index = location[`level${i}`];
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

    if (i < levels.length - 1) {
      dataNode = dataNode.children;
    }
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

// --- Arrow Button State ---
function updateArrowButtons() {
  const { prev, next } = getAdjacentSections();
  dom.prevBtn.disabled = !prev;
  dom.nextBtn.disabled = !next;
}

function getAdjacentSections() {
  const navLevels = state.currentUpanishadData.structure_levels.slice(0, -1);

  if (navLevels.length === 0) {
    return { prev: null, next: null };
  }

  // Currently only supports 2-level navigation
  if (navLevels.length === 2) {
    return getAdjacentSectionsForTwoLevels();
  }

  return { prev: null, next: null };
}

function getAdjacentSectionsForTwoLevels() {
  const { level0, level1 } = state.currentLocation;
  const level0Array = state.currentUpanishadData.content;
  const level1Array = level0Array[level0].children;

  let prev = { ...state.currentLocation };
  let next = { ...state.currentLocation };

  // Calculate next section
  if (level1 < level1Array.length - 1) {
    next.level1++;
  } else if (level0 < level0Array.length - 1) {
    next.level0++;
    next.level1 = 0;
  } else {
    next = null;
  }

  // Calculate previous section
  if (level1 > 0) {
    prev.level1--;
  } else if (level0 > 0) {
    prev.level0--;
    const prevLevel1Array = level0Array[prev.level0].children;
    prev.level1 = prevLevel1Array.length - 1;
  } else {
    prev = null;
  }

  return { prev, next };
}
