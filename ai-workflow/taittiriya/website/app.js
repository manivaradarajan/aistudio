// app.js (Phase 3: Corrected for 1-Based Routing)

let allTexts = [];
let upanishadData = {};
let currentTextFile = null;
let currentLocation = {}; // This will still store 0-based indices internally

// --- DOM References --- (no changes)
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
  addEventListeners();
  try {
    const response = await fetch("texts.json");
    if (!response.ok) throw new Error("Could not load texts.json manifest.");
    allTexts = await response.json();
    populateTextSelector();
    await handleRouteChange();
  } catch (error) {
    console.error("Initialization failed:", error);
  }
}

// --- NEW: Central Router Function (UPDATED) ---
async function handleRouteChange() {
  const pathParts = window.location.pathname.split("/").filter((p) => p);
  const textSlug = pathParts[0] || allTexts[0].slug;

  const targetText = allTexts.find((t) => t.slug === textSlug);
  if (!targetText) {
    history.replaceState({}, "", "/"); // Redirect to home on error
    await handleRouteChange();
    return;
  }

  if (currentTextFile !== targetText.file) {
    await loadText(targetText.file);
  }

  const location = {};
  const navLevels = upanishadData.structure_levels.slice(0, -1);
  let dataTraversal = upanishadData.content;

  // Convert 1-based URL numbers to 0-based indices
  for (let i = 0; i < navLevels.length; i++) {
    const levelKey = navLevels[i].toLowerCase();
    const urlNumber = parseInt(pathParts[i + 1], 10);
    // Find the item in the array whose _number property matches the URL
    const foundIndex = dataTraversal.findIndex(
      (item) => item[levelKey + "_number"] === urlNumber
    );

    const index = foundIndex !== -1 ? foundIndex : 0; // Default to 0 if not found
    location[levelKey] = index;

    const nextLevelKey = upanishadData.structure_levels[i + 1]?.toLowerCase();
    dataTraversal = dataTraversal[index]?.[nextLevelKey + "s"];
  }

  loadSection(location);

  // Find and show the specific mantra if its number is in the URL
  const leafLevelKey = upanishadData.structure_levels
    .slice(-1)[0]
    .toLowerCase();
  const leafUrlNumber = parseInt(pathParts[navLevels.length + 1], 10);

  let itemToShow = mantraDisplay.querySelector(".mantra-container"); // Default to first
  if (!isNaN(leafUrlNumber)) {
    const leafArray = mantraDisplay.querySelectorAll(".mantra-container");
    for (const item of leafArray) {
      // Find the item whose mantra_number matches the URL
      const itemData =
        upanishadData.content[location.valli]?.anuvakas[location.anuvaka]
          ?.mantras[item.dataset.mantra];
      if (itemData && itemData.mantra_number === leafUrlNumber) {
        itemToShow = item;
        break;
      }
    }
  }

  if (itemToShow) {
    showMantraDetails(itemToShow, false);
  }
}

async function loadText(filePath) {
  // ... (This function is correct and does not need changes)
  try {
    const response = await fetch(filePath);
    if (!response.ok) throw new Error(`Failed to fetch ${filePath}`);
    upanishadData = await response.json();
    currentTextFile = filePath;
    textSelector.value = filePath;
    renderNavigator();
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
  }
}

// --- UPDATED Navigation Logic ---
function navigateTo(location) {
  const textSlug = allTexts.find((t) => t.file === currentTextFile).slug;
  const navLevels = upanishadData.structure_levels.slice(0, -1);
  let path = `/${textSlug}`;

  // Convert 0-based indices to 1-based numbers for the URL
  if (navLevels.length > 0) {
    let pathNumbers = [];
    let dataTraversal = upanishadData.content;
    for (const level of navLevels) {
      const levelKey = level.toLowerCase();
      const index = location[levelKey];
      const item = dataTraversal[index];
      pathNumbers.push(item[levelKey + "_number"]);
      const nextLevelKey =
        upanishadData.structure_levels[
          navLevels.indexOf(level) + 1
        ].toLowerCase();
      dataTraversal = item[nextLevelKey + "s"];
    }
    path += "/" + pathNumbers.join("/");
  }

  history.pushState({ file: currentTextFile, location }, "", path);
  loadSection(location);
  const firstItem = mantraDisplay.querySelector(".mantra-container");
  if (firstItem) {
    showMantraDetails(firstItem, false);
  }
}

function showMantraDetails(mantraContainer, showMobilePane = true) {
  const textSlug = allTexts.find((t) => t.file === currentTextFile).slug;
  const levels = upanishadData.structure_levels;

  let pathParts = [`/${textSlug}`];
  let dataToFind = upanishadData.content;

  // Traverse to build the path and find the final mantra object
  for (let i = 0; i < levels.length; i++) {
    const key = levels[i].toLowerCase();
    const index = mantraContainer.dataset[key];
    if (index === undefined) break;
    dataToFind = dataToFind[parseInt(index)];

    // Get the 1-based number for the URL
    pathParts.push(dataToFind[key + "_number"]);

    const nextLevelKey = levels[i + 1]?.toLowerCase();
    if (nextLevelKey) {
      dataToFind = dataToFind[nextLevelKey + "s"];
    }
  }

  history.replaceState(history.state, "", pathParts.join("/"));

  // --- Original showMantraDetails logic ---
  const selected = mantraDisplay.querySelector(".selected");
  if (selected) selected.classList.remove("selected");
  mantraContainer.classList.add("selected");
  if (showMobilePane)
    mantraContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });

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

// --- Event Listeners (UPDATED) ---
function addEventListeners() {
  window.addEventListener("popstate", handleRouteChange);

  textSelector.addEventListener("change", (event) => {
    const newFile = event.target.value;
    const newSlug = allTexts.find((t) => t.file === newFile).slug;
    history.pushState({}, "", `/${newSlug}`);
    handleRouteChange();
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
    } else {
      const location = {};
      const navLevels = upanishadData.structure_levels.slice(0, -1);
      navLevels.forEach((level) => {
        const key = level.toLowerCase();
        if (link.dataset[key] !== undefined) {
          location[key] = parseInt(link.dataset[key]);
        }
      });
      navigateTo(location);
    }
    closeMobileOverlays();
  });

  mantraDisplay.addEventListener("click", (e) => {
    const container = e.target.closest(".mantra-container");
    if (container) showMantraDetails(container);
  });

  const navigateArrows = (direction) => {
    const { prev, next } = getAdjacentAnuvakas();
    const target = direction === "prev" ? prev : next;
    if (target) navigateTo(target);
  };
  prevAnuvakaBtn.addEventListener("click", () => navigateArrows("prev"));
  nextAnuvakaBtn.addEventListener("click", () => navigateArrows("next"));

  mobileNavToggle.addEventListener("click", () =>
    openMobileOverlay(navigatorPane)
  );
  mobileNavClose.addEventListener("click", closeMobileOverlays);
  mobileCommentaryClose.addEventListener("click", closeMobileOverlays);
  mobileOverlay.addEventListener("click", closeMobileOverlays);
}

// --- All other helper functions (unchanged) ---
// (Copy the full block for safety)
function populateTextSelector() {
  allTexts.forEach((text) => {
    const option = document.createElement("option");
    option.value = text.file;
    option.textContent = text.name;
    textSelector.appendChild(option);
  });
}
function renderNavigator() {
  navigatorContent.innerHTML = "";
  const levels = upanishadData.structure_levels;
  const content = upanishadData.content;
  const leafLevelName = levels.slice(-1)[0];
  const devanagariLabels = {
    Anuvaka: "अनुवाकः",
    Mantra: "मन्त्रः",
    Pada: "पादः",
    Adhyaya: "अध्यायः",
  };
  if (levels.length === 1) {
    const list = document.createElement("ul");
    content.forEach((item, index) => {
      const listItem = document.createElement("li");
      const link = document.createElement("a");
      link.href = "#";
      const label = devanagariLabels[leafLevelName] || leafLevelName;
      link.textContent = `${label} ${
        item[leafLevelName.toLowerCase() + "_number"]
      }`;
      link.dataset.leafIndex = index;
      listItem.appendChild(link);
      list.appendChild(listItem);
    });
    navigatorContent.appendChild(list);
  } else if (levels.length > 1) {
    const topLevelKey = levels[0].toLowerCase();
    const midLevelName = levels[1];
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
function updateUiState(location) {
  const activeLink = navigatorContent.querySelector("a.active");
  if (activeLink) activeLink.classList.remove("active");
  let selector = "";
  if (upanishadData.structure_levels.length === 1) {
    const leafLevelKey = upanishadData.structure_levels[0].toLowerCase();
    const leafIndex = Object.values(location)[0];
    selector = `[data-leaf-index="${leafIndex}"]`;
  } else {
    selector = Object.keys(location)
      .map((key) => `[data-${key}="${location[key]}"]`)
      .join("");
  }
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
  if (navLevels.length < 2) return { prev: null, next: null };
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
