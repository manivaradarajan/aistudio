// app.js (Final Version with Hash-Based Routing and ALL functions)

let allTexts = [];
let upanishadData = {};
let currentTextFile = null;
let currentLocation = {};

// --- DOM References ---
const bodyEl = document.body,
  textSelector = document.getElementById("text-selector"),
  navigatorPane = document.getElementById("nav-pane"),
  commentaryPane = document.getElementById("commentary-pane"),
  navigatorContent = document.getElementById("navigator-content"),
  contentTitle = document.getElementById("content-title"),
  mantraDisplay = document.getElementById("mantra-display"),
  commentaryText = document.getElementById("commentary-text"),
  mobileNavToggle = document.getElementById("mobile-nav-toggle"),
  mobileNavClose = document.getElementById("mobile-nav-close"),
  mobileCommentaryClose = document.getElementById("mobile-commentary-close"),
  mobileOverlay = document.getElementById("mobile-overlay"),
  prevBtn = document.getElementById("prev-section"),
  nextBtn = document.getElementById("next-section");

// --- Main Initialization ---
document.addEventListener("DOMContentLoaded", init);

async function init() {
  addEventListeners();
  try {
    const response = await fetch("texts.json");
    if (!response.ok) throw new Error("Could not load texts.json manifest.");
    allTexts = await response.json();
    populateTextSelector(); // This will now work
    await handleRouteChange();
  } catch (error) {
    console.error("Initialization failed:", error);
  }
}

// --- RESTORED FUNCTION ---
function populateTextSelector() {
  allTexts.forEach((text) => {
    const option = document.createElement("option");
    option.value = text.file;
    option.textContent = text.name;
    textSelector.appendChild(option);
  });
}

// --- Routing ---
async function handleRouteChange() {
  const path = window.location.hash.slice(1);
  const pathParts = path.split("/").filter((p) => p);
  const textSlug = pathParts[0] || allTexts[0].slug;

  const targetText = allTexts.find((t) => t.slug === textSlug);
  if (!targetText) {
    window.location.hash = "/";
    return;
  }

  if (currentTextFile !== targetText.file) {
    await loadText(targetText.file);
  }

  const location = {};
  const navLevels = upanishadData.structure_levels.slice(0, -1);
  let dataTraversal = upanishadData.content;

  for (let i = 0; i < navLevels.length; i++) {
    const levelKey = `level${i}`;
    const levelName = navLevels[i].toLowerCase();
    const urlNumber = parseInt(pathParts[i + 1], 10);
    const foundIndex = dataTraversal.findIndex(
      (item) => item[levelName + "_number"] === urlNumber
    );
    const index = foundIndex !== -1 ? foundIndex : 0;
    location[levelKey] = index;
    const nextLevelName = upanishadData.structure_levels[i + 1]?.toLowerCase();
    dataTraversal = dataTraversal[index]?.[nextLevelName + "s"];
  }
  loadSection(location);

  const leafLevelKey = upanishadData.structure_levels
    .slice(-1)[0]
    .toLowerCase();
  const leafUrlNumber = parseInt(pathParts[pathParts.length - 1], 10);

  let itemToShow = mantraDisplay.querySelector(".item-container");
  if (!isNaN(leafUrlNumber)) {
    const leafArray = mantraDisplay.querySelectorAll(".item-container");
    for (const item of leafArray) {
      if (parseInt(item.dataset.number, 10) === leafUrlNumber) {
        itemToShow = item;
        break;
      }
    }
  }
  if (itemToShow) showItemDetails(itemToShow, false);
}

function navigateTo(location, leafIndex) {
  const textSlug = allTexts.find((t) => t.file === currentTextFile).slug;
  const navLevels = upanishadData.structure_levels.slice(0, -1);
  let path = `/${textSlug}`;

  if (navLevels.length > 0) {
    let pathNumbers = [];
    let dataTraversal = upanishadData.content;
    for (let i = 0; i < navLevels.length; i++) {
      const levelKey = navLevels[i].toLowerCase();
      const index = location[`level${i}`];
      const item = dataTraversal[index];
      pathNumbers.push(item[levelKey + "_number"]);
      const nextLevelKey = upanishadData.structure_levels[i + 1]?.toLowerCase();
      dataTraversal = item[nextLevelKey + "s"];
    }
    path += "/" + pathNumbers.join("/");
  }

  if (leafIndex !== undefined) {
    if (navLevels.length === 0) {
      path += `/${leafIndex}`;
    } else {
      path += `/${leafIndex}`;
    }
  }
  window.location.hash = path;
}

// --- Data Loading and Rendering ---
async function loadText(filePath) {
  try {
    const response = await fetch(filePath);
    if (!response.ok) throw new Error(`Failed to fetch ${filePath}`);
    upanishadData = await response.json();
    currentTextFile = filePath;
    textSelector.value = filePath;
    renderNavigator();
    if (window.Split && window.innerWidth > 800) {
      document.querySelectorAll(".gutter").forEach((g) => g.remove());
      window.Split(["#nav-pane", "#main-pane", "#commentary-pane"], {
        sizes: [25, 45, 30],
        minSize: [200, 300, 300],
        gutterSize: 2,
        cursor: "col-resize",
      });
    }
  } catch (error) {
    console.error(`Error loading text from ${filePath}:`, error);
  }
}

function renderNavigator() {
  navigatorContent.innerHTML = "";
  const levels = upanishadData.structure_levels;
  const content = upanishadData.content;
  const leafLevelName = levels.slice(-1)[0];
  const labels = { Anuvaka: "अनुवाकः", Mantra: "मन्त्रः" };
  if (levels.length === 1) {
    const list = document.createElement("ul");
    content.forEach((item, index) => {
      const listItem = document.createElement("li");
      const link = document.createElement("a");
      link.href = "#";
      const label = labels[leafLevelName] || leafLevelName;
      link.textContent = `${label} ${
        item[leafLevelName.toLowerCase() + "_number"]
      }`;
      link.dataset.leafIndex = index;
      listItem.appendChild(link);
      list.appendChild(listItem);
    });
    navigatorContent.appendChild(list);
  } else if (levels.length > 1) {
    const topLevelName = levels[0];
    const midLevelName = levels[1];
    content.forEach((topItem, topIndex) => {
      const details = document.createElement("details");
      details.className = "accordion-group";
      details.dataset.level0 = topIndex;
      const summary = document.createElement("summary");
      summary.textContent = topItem[topLevelName.toLowerCase() + "_name"];
      details.appendChild(summary);
      const list = document.createElement("ul");
      const midLevelArrayKey = midLevelName.toLowerCase() + "s";
      topItem[midLevelArrayKey].forEach((midItem, midIndex) => {
        const listItem = document.createElement("li");
        const link = document.createElement("a");
        link.href = "#";
        const label = labels[midLevelName] || midLevelName;
        link.textContent = `${label} ${
          midItem[midLevelName.toLowerCase() + "_number"]
        }`;
        link.dataset.level0 = topIndex;
        link.dataset.level1 = midIndex;
        listItem.appendChild(link);
        list.appendChild(listItem);
      });
      details.appendChild(list);
      navigatorContent.appendChild(details);
    });
  }
}

function loadSection(location) {
  currentLocation = location;
  const levels = upanishadData.structure_levels;
  const navLevels = levels.slice(0, -1);
  let titleParts = [upanishadData.text_name];
  let dataToRender = upanishadData.content;
  if (navLevels.length > 0) {
    for (let i = 0; i < navLevels.length; i++) {
      const index = location[`level${i}`];
      if (index === undefined) break;
      const levelName = navLevels[i];
      dataToRender = dataToRender[index];
      titleParts.push(
        dataToRender[levelName.toLowerCase() + "_name"] ||
          `${levelName} ${dataToRender[levelName.toLowerCase() + "_number"]}`
      );
      const nextLevelName = levels[i + 1];
      dataToRender = dataToRender[nextLevelName.toLowerCase() + "s"];
    }
  }
  mantraDisplay.innerHTML = "";
  const leafLevelName = levels.slice(-1)[0];
  const leafLevelKey = leafLevelName.toLowerCase();
  if (Array.isArray(dataToRender)) {
    dataToRender.forEach((item, index) => {
      const itemContainer = document.createElement("div");
      itemContainer.className = "item-container";
      let itemPath = { ...location };
      itemPath[`level${navLevels.length}`] = index;
      Object.keys(itemPath).forEach(
        (k) => (itemContainer.dataset[k] = itemPath[k])
      );
      itemContainer.dataset.number = item[leafLevelKey + "_number"];
      const numberEl = document.createElement("p");
      numberEl.className = "item-number";
      numberEl.textContent = item[leafLevelKey + "_number"];
      const textEl = document.createElement("p");
      textEl.className = "item-text";
      textEl.textContent = item[leafLevelKey + "_text"];
      itemContainer.appendChild(numberEl);
      itemContainer.appendChild(textEl);
      mantraDisplay.appendChild(itemContainer);
    });
  }
  contentTitle.textContent = titleParts.join(" - ");
  updateUiState(location);
}

function showItemDetails(itemContainer, showMobilePane = true) {
  const selected = mantraDisplay.querySelector(".selected");
  if (selected) selected.classList.remove("selected");
  itemContainer.classList.add("selected");
  if (showMobilePane)
    itemContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
  let dataToFind = upanishadData.content;
  const levels = upanishadData.structure_levels;
  for (let i = 0; i < levels.length; i++) {
    const index = itemContainer.dataset[`level${i}`];
    if (index === undefined) break;
    dataToFind = dataToFind[parseInt(index)];
    if (i < levels.length - 1) {
      dataToFind = dataToFind[levels[i + 1].toLowerCase() + "s"];
    }
  }
  const itemData = dataToFind;

  const leafLevelKey = levels.slice(-1)[0].toLowerCase();
  const leafIndex = itemData[leafLevelKey + "_number"];

  // Create new location object for navigateTo
  const newLocation = {};
  const navLevels = levels.slice(0, -1);
  navLevels.forEach((level, i) => {
    newLocation[`level${i}`] = parseInt(itemContainer.dataset[`level${i}`]);
  });

  navigateTo(newLocation, leafIndex);

  if (itemData && itemData.commentary_text) {
    commentaryText.innerHTML = marked.parse(itemData.commentary_text);
  } else {
    commentaryText.innerHTML = "<p>No commentary available.</p>";
  }
  if (window.innerWidth <= 800 && showMobilePane) {
    openMobileOverlay(commentaryPane);
  }
}

function updateUiState(location) {
  const activeLink = navigatorContent.querySelector("a.active");
  if (activeLink) activeLink.classList.remove("active");
  let selector = Object.keys(location)
    .map((key) => `[data-${key}="${location[key]}"]`)
    .join("");
  if (
    upanishadData.structure_levels.length === 1 &&
    location.leafIndex !== undefined
  ) {
    selector = `[data-leaf-index="${location.leafIndex}"]`;
  }
  const newLink = navigatorContent.querySelector(`a${selector}`);
  if (newLink) newLink.classList.add("active");
  document
    .querySelectorAll(".accordion-group")
    .forEach((el) => (el.open = false));
  if (location["level0"] !== undefined) {
    const activeAccordion = navigatorContent.querySelector(
      `[data-level0="${location["level0"]}"]`
    );
    if (activeAccordion) activeAccordion.open = true;
  }
  updateArrowButtons();
}

function addEventListeners() {
  window.addEventListener("hashchange", handleRouteChange);
  textSelector.addEventListener("change", (event) => {
    const newFile = event.target.value;
    const newSlug = allTexts.find((t) => t.file === newFile).slug;
    window.location.hash = `/${newSlug}`;
  });
  navigatorContent.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (!link) return;
    e.preventDefault();
    if (upanishadData.structure_levels.length === 1) {
      const index = link.dataset.leafIndex;
      const targetItem =
        mantraDisplay.querySelectorAll(".item-container")[index];
      if (targetItem) showItemDetails(targetItem, false);
    } else {
      const location = {};
      const navLevels = upanishadData.structure_levels.slice(0, -1);
      for (let i = 0; i < navLevels.length; i++) {
        if (link.dataset[`level${i}`] !== undefined) {
          location[`level${i}`] = parseInt(link.dataset[`level${i}`]);
        }
      }
      navigateTo(location);
    }
    closeMobileOverlays();
  });
  mantraDisplay.addEventListener("click", (e) => {
    const container = e.target.closest(".item-container");
    if (container) showItemDetails(container);
  });
  const navigateArrows = (direction) => {
    const { prev, next } = getAdjacentSections();
    const target = direction === "prev" ? prev : next;
    if (target) navigateTo(target);
  };
  prevBtn.addEventListener("click", () => navigateArrows("prev"));
  nextBtn.addEventListener("click", () => navigateArrows("next"));
  mobileNavToggle.addEventListener("click", () =>
    openMobileOverlay(navigatorPane)
  );
  mobileNavClose.addEventListener("click", closeMobileOverlays);
  mobileCommentaryClose.addEventListener("click", closeMobileOverlays);
  mobileOverlay.addEventListener("click", closeMobileOverlays);
}

function openMobileOverlay(pane) {
  pane.classList.add("active");
  mobileOverlay.classList.add("active");
  bodyEl.classList.add("mobile-overlay-active");
}
function closeMobileOverlays() {
  navigatorPane.classList.remove("active");
  commentaryPane.classList.remove("active");
  mobileOverlay.classList.remove("active");
  bodyEl.classList.remove("mobile-overlay-active");
}
function updateArrowButtons() {
  const { prev, next } = getAdjacentSections();
  prevBtn.disabled = !prev;
  nextBtn.disabled = !next;
}
function getAdjacentSections() {
  const navLevels = upanishadData.structure_levels.slice(0, -1);
  if (navLevels.length < 2) return { prev: null, next: null };
  const level0Key = "level0";
  const level1Key = "level1";
  const level0Index = currentLocation[level0Key];
  const level1Index = currentLocation[level1Key];
  let prev = { ...currentLocation };
  let next = { ...currentLocation };
  const level1ArrayKey = navLevels[1].toLowerCase() + "s";
  if (
    level1Index <
    upanishadData.content[level0Index][level1ArrayKey].length - 1
  ) {
    next[level1Key]++;
  } else if (level0Index < upanishadData.content.length - 1) {
    next[level0Key]++;
    next[level1Key] = 0;
  } else {
    next = null;
  }
  if (level1Index > 0) {
    prev[level1Key]--;
  } else if (level0Index > 0) {
    prev[level0Key]--;
    const prevLevel1Array =
      upanishadData.content[prev[level0Key]][level1ArrayKey];
    prev[level1Key] = prevLevel1Array.length - 1;
  } else {
    prev = null;
  }
  return { prev, next };
}
