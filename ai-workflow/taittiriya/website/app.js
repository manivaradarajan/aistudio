// app.js (Corrected with Devanagari Labels)

let allTexts = [];
let upanishadData = {};
let currentLocation = {};

// --- DOM Element References ---
// ... (same as before) ...
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
  prevAnuvakaBtn = document.getElementById("prev-anuvaka"),
  nextAnuvakaBtn = document.getElementById("next-anuvaka");

// --- Main Initialization ---
document.addEventListener("DOMContentLoaded", init);
async function init() {
  // ... (same as before) ...
  addEventListeners();
  try {
    const response = await fetch("texts.json");
    if (!response.ok) throw new Error("Could not load texts.json manifest.");
    allTexts = await response.json();
    populateTextSelector();
    await loadText(allTexts[0].file);
  } catch (error) {
    console.error("Initialization failed:", error);
    contentTitle.textContent = "Error";
    mantraDisplay.innerHTML = `<p style="color:red;">Could not load application data. Please check console.</p>`;
  }
}

// ... (populateTextSelector and loadText are the same as before) ...

/**
 * GENERIC: Renders navigator, NOW WITH DEVANAGARI LABELS
 */
function renderNavigator() {
  navigatorContent.innerHTML = "";
  const levels = upanishadData.structure_levels;
  const content = upanishadData.content;
  const leafLevelName = levels.slice(-1)[0];

  // --- NEW: A map for Devanagari labels ---
  const devanagariLabels = {
    Anuvaka: "अनुवाकः",
    Mantra: "मन्त्रः",
    Pada: "पादः",
    Adhyaya: "अध्यायः",
    // Add more as you add new texts with different structures
  };
  // -----------------------------------------

  // Case 1: Simple list (e.g., Isavasya)
  if (levels.length === 1) {
    const list = document.createElement("ul");
    content.forEach((item, index) => {
      const listItem = document.createElement("li");
      const link = document.createElement("a");
      link.href = "#";

      // USE THE MAP to get the label
      const label = devanagariLabels[leafLevelName] || leafLevelName;
      link.textContent = `${label} ${
        item[leafLevelName.toLowerCase() + "_number"]
      }`;

      link.dataset.leafIndex = index;
      listItem.appendChild(link);
      list.appendChild(listItem);
    });
    navigatorContent.appendChild(list);
  }
  // Case 2: Hierarchical (e.g., Taittiriya)
  else if (levels.length > 1) {
    const topLevelKey = levels[0].toLowerCase();
    const midLevelName = levels[1]; // "Anuvaka"
    const midLevelKey = midLevelName.toLowerCase();
    const midLevelArrayKey = midLevelKey + "s";

    content.forEach((topItem, topIndex) => {
      const details = document.createElement("details");
      details.className = "valli-group";
      details.dataset[topLevelKey] = topIndex;

      const summary = document.createElement("summary");
      summary.textContent = topItem[topLevelKey + "_name"];
      details.appendChild(summary);

      const list = document.createElement("ul");
      topItem[midLevelArrayKey].forEach((midItem, midIndex) => {
        const listItem = document.createElement("li");
        const link = document.createElement("a");
        link.href = "#";

        // USE THE MAP to get the label
        const label = devanagariLabels[midLevelName] || midLevelName;
        link.textContent = `${label} ${midItem[midLevelKey + "_number"]}`;

        link.dataset[topLevelKey] = topIndex;
        link.dataset[midLevelKey] = midIndex;
        listItem.appendChild(link);
        list.appendChild(listItem);
      });
      details.appendChild(list);
      navigatorContent.appendChild(details);
    });
  }
}

// --- ALL OTHER FUNCTIONS ARE UNCHANGED ---
// Paste the full code below to be safe.

function populateTextSelector() {
  allTexts.forEach((text) => {
    const option = document.createElement("option");
    option.value = text.file;
    option.textContent = text.name;
    textSelector.appendChild(option);
  });
}

async function loadText(filePath) {
  try {
    const response = await fetch(filePath);
    if (!response.ok) throw new Error(`Failed to fetch ${filePath}`);
    upanishadData = await response.json();
    currentLocation = {};
    const navLevels = upanishadData.structure_levels.slice(0, -1);
    if (navLevels.length > 0) {
      navLevels.forEach((level) => {
        currentLocation[level.toLowerCase()] = 0;
      });
    }
    contentTitle.textContent = upanishadData.text_name;
    renderNavigator();
    loadSection(currentLocation);
    const firstItem = mantraDisplay.querySelector(".mantra-container");
    if (firstItem) {
      showMantraDetails(firstItem, false);
    }
    if (window.Split && window.innerWidth > 800) {
      const gutters = document.querySelectorAll(".gutter");
      gutters.forEach((g) => g.remove());
      window.Split(["#nav-pane", "#main-pane", "#commentary-pane"], {
        sizes: [25, 45, 30],
        minSize: [200, 300, 300],
        gutterSize: 2,
        cursor: "col-resize",
      });
    }
  } catch (error) {
    console.error(`Error loading text from ${filePath}:`, error);
    mantraDisplay.innerHTML = `<p style="color:red;">Could not load the selected text.</p>`;
  }
}

function loadSection(location) {
  currentLocation = location;
  const levels = upanishadData.structure_levels;
  const navLevels = levels.slice(0, -1);
  let titleParts = [upanishadData.text_name];
  let dataToRender = upanishadData.content;
  if (navLevels.length > 0) {
    for (const level of navLevels) {
      const key = level.toLowerCase();
      const index = location[key];
      if (index === undefined) break;
      dataToRender = dataToRender[index];
      titleParts.push(
        dataToRender[key + "_name"] ||
          `${level} ${dataToRender[key + "_number"]}`
      );
      const nextLevelKey = levels[levels.indexOf(level) + 1].toLowerCase();
      dataToRender = dataToRender[nextLevelKey + "s"];
    }
  }
  mantraDisplay.innerHTML = "";
  const leafLevelKey = levels.slice(-1)[0].toLowerCase();
  if (Array.isArray(dataToRender)) {
    dataToRender.forEach((item, index) => {
      const itemContainer = document.createElement("div");
      itemContainer.className = "mantra-container";
      const itemPath = { ...location, [leafLevelKey]: index };
      Object.keys(itemPath).forEach(
        (k) => (itemContainer.dataset[k] = itemPath[k])
      );
      const numberEl = document.createElement("p");
      numberEl.className = "mantra-number";
      numberEl.textContent = item[leafLevelKey + "_number"];
      const textEl = document.createElement("p");
      textEl.className = "mantra-text";
      textEl.textContent = item[leafLevelKey + "_text"];
      itemContainer.appendChild(numberEl);
      itemContainer.appendChild(textEl);
      mantraDisplay.appendChild(itemContainer);
    });
  } else {
    mantraDisplay.innerHTML = "";
    upanishadData.content.forEach((item, index) => {
      const itemContainer = document.createElement("div");
      itemContainer.className = "mantra-container";
      itemContainer.dataset[leafLevelKey] = index;
      const numberEl = document.createElement("p");
      numberEl.className = "mantra-number";
      numberEl.textContent = item[leafLevelKey + "_number"];
      const textEl = document.createElement("p");
      textEl.className = "mantra-text";
      textEl.textContent = item[leafLevelKey + "_text"];
      itemContainer.appendChild(numberEl);
      itemContainer.appendChild(textEl);
      mantraDisplay.appendChild(itemContainer);
    });
    titleParts = [upanishadData.text_name];
  }
  contentTitle.textContent = titleParts.join(" - ");
  updateUiState(location);
}

function showMantraDetails(mantraContainer, showMobilePane = true) {
  const selected = mantraDisplay.querySelector(".selected");
  if (selected) selected.classList.remove("selected");
  mantraContainer.classList.add("selected");
  mantraContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
  let dataToFind = upanishadData.content;
  const levels = upanishadData.structure_levels;
  for (let i = 0; i < levels.length; i++) {
    const key = levels[i].toLowerCase();
    const index = mantraContainer.dataset[key];
    if (index === undefined) break;
    dataToFind = dataToFind[parseInt(index)];
    const nextLevelKey = levels[i + 1]?.toLowerCase();
    if (nextLevelKey) {
      dataToFind = dataToFind[nextLevelKey + "s"];
    }
  }
  const mantraData = dataToFind;
  if (mantraData && mantraData.commentary_text) {
    commentaryText.innerHTML = marked.parse(mantraData.commentary_text);
  } else {
    commentaryText.innerHTML =
      "<p>No commentary available for this selection.</p>";
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
  const newLink = navigatorContent.querySelector(`a${selector}`);
  if (newLink) newLink.classList.add("active");
  document.querySelectorAll(".valli-group").forEach((el) => (el.open = false));
  const topLevelKey = upanishadData.structure_levels[0].toLowerCase();
  if (location[topLevelKey] !== undefined) {
    const activeAccordion = navigatorContent.querySelector(
      `[data-${topLevelKey}="${location[topLevelKey]}"]`
    );
    if (activeAccordion) activeAccordion.open = true;
  }
  updateArrowButtons();
}

function addEventListeners() {
  textSelector.addEventListener("change", (event) => {
    loadText(event.target.value);
  });
  navigatorContent.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (!link) return;
    e.preventDefault();
    if (upanishadData.structure_levels.length === 1) {
      const index = link.dataset.leafIndex;
      const targetItem =
        mantraDisplay.querySelectorAll(".mantra-container")[index];
      if (targetItem) showMantraDetails(targetItem, false);
      const activeLink = navigatorContent.querySelector("a.active");
      if (activeLink) activeLink.classList.remove("active");
      link.classList.add("active");
    } else {
      const location = {};
      const navLevels = upanishadData.structure_levels.slice(0, -1);
      navLevels.forEach((level) => {
        const key = level.toLowerCase();
        if (link.dataset[key] !== undefined) {
          location[key] = parseInt(link.dataset[key]);
        }
      });
      loadSection(location);
      const firstMantra = mantraDisplay.querySelector(".mantra-container");
      if (firstMantra) showMantraDetails(firstMantra, false);
    }
    closeMobileOverlays();
  });
  mantraDisplay.addEventListener("click", (e) => {
    const container = e.target.closest(".mantra-container");
    if (container) showMantraDetails(container);
  });
  const navigate = (direction) => {
    const { prev, next } = getAdjacentAnuvakas();
    const target = direction === "prev" ? prev : next;
    if (target) {
      loadSection(target);
      const firstMantra = mantraDisplay.querySelector(".mantra-container");
      if (firstMantra) showMantraDetails(firstMantra, false);
    }
  };
  prevAnuvakaBtn.addEventListener("click", () => navigate("prev"));
  nextAnuvakaBtn.addEventListener("click", () => navigate("next"));
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
  const { prev, next } = getAdjacentAnuvakas();
  prevAnuvakaBtn.disabled = !prev;
  nextAnuvakaBtn.disabled = !next;
}
function getAdjacentAnuvakas() {
  const navLevels = upanishadData.structure_levels.slice(0, -1);
  if (navLevels.length === 0) return { prev: null, next: null };
  const topLevelKey = navLevels[0].toLowerCase();
  const midLevelKey = navLevels[1].toLowerCase();
  const valli = currentLocation[topLevelKey];
  const anuvaka = currentLocation[midLevelKey];
  let prev = null,
    next = null;
  if (anuvaka > 0) {
    prev = { [topLevelKey]: valli, [midLevelKey]: anuvaka - 1 };
  } else if (valli > 0) {
    const prevValliIndex = valli - 1;
    const prevMidLevelArrayKey = midLevelKey + "s";
    const prevAnuvakaIndex =
      upanishadData.content[prevValliIndex][prevMidLevelArrayKey].length - 1;
    prev = { [topLevelKey]: prevValliIndex, [midLevelKey]: prevAnuvakaIndex };
  }
  const midLevelArrayKey = midLevelKey + "s";
  if (anuvaka < upanishadData.content[valli][midLevelArrayKey].length - 1) {
    next = { [topLevelKey]: valli, [midLevelKey]: anuvaka + 1 };
  } else if (valli < upanishadData.content.length - 1) {
    next = { [topLevelKey]: valli + 1, [midLevelKey]: 0 };
  }
  return { prev, next };
}
