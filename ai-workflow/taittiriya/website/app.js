// app.js (Corrected to auto-show commentary from URL)

let allTexts = [];
let upanishadData = {};
let currentTextFile = null;
let currentLocation = {};

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
    populateTextSelector();
    await handleRouteChange();
  } catch (error) {
    console.error("Initialization failed:", error);
  }
}

// --- UPDATED Central Router ---
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

  // Determine the section to load based on URL
  for (let i = 0; i < navLevels.length; i++) {
    const urlNumber = parseInt(pathParts[i + 1], 10) || 1; // Default to 1 if not present
    const foundIndex = dataTraversal.findIndex(
      (item) => item.number === urlNumber
    );
    const index = foundIndex !== -1 ? foundIndex : 0;
    location[`level${i}`] = index;
    dataTraversal = dataTraversal[index]?.children;
  }
  loadSection(location);

  // --- THIS IS THE FIX ---
  // Now, find the specific item to show based on the full URL path
  const leafUrlNumber = parseInt(pathParts[navLevels.length + 1], 10);

  let itemToSelect = mantraDisplay.querySelector(".item-container"); // Default to the first item

  if (!isNaN(leafUrlNumber)) {
    // Find the specific item container whose 'data-number' matches the URL
    const allItems = mantraDisplay.querySelectorAll(".item-container");
    for (const item of allItems) {
      if (parseInt(item.dataset.number, 10) === leafUrlNumber) {
        itemToSelect = item;
        break;
      }
    }
  }

  // Finally, "click" the correct item to show its details
  if (itemToSelect) {
    showItemDetails(itemToSelect, false); // false = don't show mobile pane automatically
  }
  // --- END OF FIX ---
}

// --- All other functions remain the same ---
// (Pasting the full, correct code below for safety)

function populateTextSelector() {
  allTexts.forEach((text) => {
    const option = document.createElement("option");
    option.value = text.file;
    option.textContent = text.name;
    textSelector.appendChild(option);
  });
}
function navigateTo(path) {
  if (window.location.hash !== `#${path}`) {
    window.location.hash = path;
  }
}
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
  const textSlug = allTexts.find((t) => t.file === currentTextFile).slug;
  const labels = { Anuvaka: "अनुवाकः", Mantra: "मन्त्रः" };
  if (levels.length === 1) {
    const list = document.createElement("ul");
    content.forEach((item, index) => {
      const listItem = document.createElement("li");
      const link = document.createElement("a");
      link.href = `#/${textSlug}/${item.number}`;
      const label = labels[item.type] || item.type;
      link.textContent = `${label} ${item.number}`;
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
      summary.textContent = topItem.name;
      details.appendChild(summary);
      const list = document.createElement("ul");
      topItem.children.forEach((midItem, midIndex) => {
        const listItem = document.createElement("li");
        const link = document.createElement("a");
        link.href = `#/${textSlug}/${topItem.number}/${midItem.number}`;
        const label = labels[midLevelName] || midLevelName;
        link.textContent = `${label} ${midItem.number}`;
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
      dataToRender = dataToRender[index];
      titleParts.push(
        dataToRender.name || `${levels[i]} ${dataToRender.number}`
      );
      dataToRender = dataToRender.children;
    }
  }
  mantraDisplay.innerHTML = "";
  if (Array.isArray(dataToRender)) {
    dataToRender.forEach((item, index) => {
      const itemContainer = document.createElement("div");
      itemContainer.className = "item-container";
      let itemPath = { ...location };
      itemPath[`level${navLevels.length}`] = index;
      Object.keys(itemPath).forEach(
        (k) => (itemContainer.dataset[k] = itemPath[k])
      );
      itemContainer.dataset.number = item.number;
      const numberEl = document.createElement("p");
      numberEl.className = "item-number";
      numberEl.textContent = item.number;
      const textEl = document.createElement("p");
      textEl.className = "item-text";
      textEl.textContent = item.text;
      itemContainer.appendChild(numberEl);
      itemContainer.appendChild(textEl);
      mantraDisplay.appendChild(itemContainer);
    });
  }
  contentTitle.textContent = titleParts.join(" - ");
  updateUiState(location);
}

// In app.js, replace the old showItemDetails function with this one.

function showItemDetails(itemContainer, showMobilePane = true) {
  const selected = mantraDisplay.querySelector(".selected");
  if (selected) selected.classList.remove("selected");
  itemContainer.classList.add("selected");

  // THIS IS THE FIX: This line is now unconditional.
  // It will scroll the selected item into view every time.
  itemContainer.scrollIntoView({ behavior: "smooth", block: "center" });

  let dataToFind = upanishadData.content;
  const levels = upanishadData.structure_levels;

  for (let i = 0; i < levels.length; i++) {
    const index = itemContainer.dataset[`level${i}`];
    if (index === undefined) break;
    dataToFind = dataToFind[parseInt(index)];
    if (i < levels.length - 1) {
      dataToFind = dataToFind.children;
    }
  }

  const itemData = dataToFind;
  if (itemData) {
    // Update the URL hash without triggering a full re-route
    const newPath = buildPathFromContainer(itemContainer);
    if (window.location.hash !== `#${newPath}`) {
      history.replaceState(history.state, "", `#${newPath}`);
    }

    if (itemData.commentary_text) {
      commentaryText.innerHTML = marked.parse(itemData.commentary_text);
    } else {
      commentaryText.innerHTML = "<p>No commentary available.</p>";
    }
  }

  // This part remains conditional, only opening the sheet on a direct tap.
  if (window.innerWidth <= 800 && showMobilePane) {
    openMobileOverlay(commentaryPane);
  }
}

function updateUiState(location) {
  const activeLink = navigatorContent.querySelector("a.active");
  if (activeLink) activeLink.classList.remove("active");
  const path = window.location.hash;
  const newLink = navigatorContent.querySelector(`a[href="${path}"]`);
  if (newLink) {
    newLink.classList.add("active");
  } else {
    const pathParts = path.slice(1).split("/");
    const sectionPath = pathParts.slice(0, -1).join("/");
    const sectionLink = navigatorContent.querySelector(
      `a[href="#${sectionPath}"]`
    );
    if (sectionLink) sectionLink.classList.add("active");
  }
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
  textSelector.addEventListener("change", (e) => {
    const newSlug = allTexts.find((t) => t.file === e.target.value).slug;
    window.location.hash = `/${newSlug}`;
  });
  navigatorContent.addEventListener("click", (e) => {
    closeMobileOverlays();
  });
  mantraDisplay.addEventListener("click", (e) => {
    const container = e.target.closest(".item-container");
    if (container) {
      const newPath = buildPathFromContainer(container);
      navigateTo(newPath);
      showItemDetails(container);
    }
  });
  const navigateArrows = (direction) => {
    const { prev, next } = getAdjacentSections();
    const target = direction === "prev" ? prev : next;
    if (target) {
      const textSlug = allTexts.find((t) => t.file === currentTextFile).slug;
      const navLevels = upanishadData.structure_levels.slice(0, -1);
      let pathNumbers = [];
      let dataTraversal = upanishadData.content;
      for (let i = 0; i < navLevels.length; i++) {
        const index = target[`level${i}`];
        const item = dataTraversal[index];
        pathNumbers.push(item.number);
        dataTraversal = item.children;
      }
      navigateTo(`/${textSlug}/${pathNumbers.join("/")}`);
    }
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
function buildPathFromContainer(container) {
  const textSlug = allTexts.find((t) => t.file === currentTextFile).slug;
  const levels = upanishadData.structure_levels;
  let pathParts = [textSlug];
  let dataNode = upanishadData.content;
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
  if (navLevels.length === 0) return { prev: null, next: null };
  let prev = { ...currentLocation };
  let next = { ...currentLocation };
  if (navLevels.length === 2) {
    const level0Index = currentLocation.level0;
    const level1Index = currentLocation.level1;
    const level1Array = upanishadData.content[level0Index].children;
    if (level1Index < level1Array.length - 1) {
      next.level1++;
    } else if (level0Index < upanishadData.content.length - 1) {
      next.level0++;
      next.level1 = 0;
    } else {
      next = null;
    }
    if (level1Index > 0) {
      prev.level1--;
    } else if (level0Index > 0) {
      prev.level0--;
      const prevLevel1Array = upanishadData.content[prev.level0].children;
      prev.level1 = prevLevel1Array.length - 1;
    } else {
      prev = null;
    }
    return { prev, next };
  }
  return { prev, next: null };
}
