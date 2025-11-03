// app.js (Refactored for maintainability)

// --- Application State ---
const state = {
  allTexts: [],
  currentText: null,
  currentUpanishadData: null,
  currentLocation: {},
};

// --- DOM References ---
const dom = {
  body: document.body,
  textSelector: document.getElementById("text-selector"),
  navigatorPane: document.getElementById("nav-pane"),
  commentaryPane: document.getElementById("commentary-pane"),
  navigatorContent: document.getElementById("navigator-content"),
  contentTitle: document.getElementById("content-title"),
  mantraDisplay: document.getElementById("mantra-display"),
  commentaryText: document.getElementById("commentary-text"),
  mobileNavToggle: document.getElementById("mobile-nav-toggle"),
  mobileNavClose: document.getElementById("mobile-nav-close"),
  mobileCommentaryClose: document.getElementById("mobile-commentary-close"),
  mobileOverlay: document.getElementById("mobile-overlay"),
  prevBtn: document.getElementById("prev-section"),
  nextBtn: document.getElementById("next-section"),
};

// --- Main Initialization ---
document.addEventListener("DOMContentLoaded", init);

async function init() {
  addEventListeners();
  try {
    const response = await fetch("texts.json");
    if (!response.ok) throw new Error("Could not load texts.json manifest.");
    state.allTexts = await response.json();
    populateTextSelector();
    await handleRouteChange();
  } catch (error) {
    console.error("Initialization failed:", error);
  }
}

// --- Central Router ---
async function handleRouteChange() {
  const pathParts = window.location.hash.slice(1).split("/").filter(Boolean);
  const textSlug = pathParts[0] || state.allTexts[0]?.slug;

  const targetText = state.allTexts.find((t) => t.slug === textSlug);

  if (!targetText) {
    console.error(`Text with slug '${textSlug}' not found.`);
    window.location.hash = state.allTexts[0]?.slug
      ? `/${state.allTexts[0].slug}`
      : "/";
    return;
  }

  if (state.currentText?.file !== targetText.file) {
    await loadText(targetText);
  }

  const navLevels = state.currentUpanishadData.structure_levels.slice(0, -1);
  const location = {};
  let dataTraversal = state.currentUpanishadData.content;

  for (let i = 0; i < navLevels.length; i++) {
    const urlNumber = parseInt(pathParts[i + 1], 10) || 1;
    const foundIndex = dataTraversal.findIndex(
      (item) => item.number === urlNumber
    );
    const index = foundIndex !== -1 ? foundIndex : 0;
    location[`level${i}`] = index;
    dataTraversal = dataTraversal[index]?.children;
  }

  loadSection(location);
  selectItemFromUrl(pathParts);
}

function selectItemFromUrl(pathParts) {
  const navLevels = state.currentUpanishadData.structure_levels.slice(0, -1);
  const leafUrlNumber = parseInt(pathParts[navLevels.length + 1], 10);

  let itemToSelect = dom.mantraDisplay.querySelector(".item-container"); // Default to first

  if (!isNaN(leafUrlNumber)) {
    const allItems = dom.mantraDisplay.querySelectorAll(".item-container");
    for (const item of allItems) {
      if (parseInt(item.dataset.number, 10) === leafUrlNumber) {
        itemToSelect = item;
        break;
      }
    }
  }

  if (itemToSelect) {
    showItemDetails(itemToSelect, false); // false = don't show mobile pane automatically
  }
}

function populateTextSelector() {
  state.allTexts.forEach((text) => {
    const option = document.createElement("option");
    option.value = text.file;
    option.textContent = text.name;
    dom.textSelector.appendChild(option);
  });
}

function navigateTo(path) {
  if (window.location.hash !== `#${path}`) {
    window.location.hash = path;
  }
}

async function loadText(textObject) {
  try {
    const response = await fetch(textObject.file);
    if (!response.ok) throw new Error(`Failed to fetch ${textObject.file}`);
    state.currentUpanishadData = await response.json();
    state.currentText = textObject;
    dom.textSelector.value = textObject.file;

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
    console.error(`Error loading text from ${textObject.file}:`, error);
  }
}
function renderNavigator() {
  dom.navigatorContent.innerHTML = "";
  const levels = state.currentUpanishadData.structure_levels;
  const content = state.currentUpanishadData.content;
  const textSlug = state.currentText.slug;
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
    dom.navigatorContent.appendChild(list);
  } else if (levels.length > 1) {
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
        link.textContent = midItem.name || `${label} ${midItem.number}`;
        link.dataset.level0 = topIndex;
        link.dataset.level1 = midIndex;
        listItem.appendChild(link);
        list.appendChild(listItem);
      });
      details.appendChild(list);
      dom.navigatorContent.appendChild(details);
    });
  }
}

function loadSection(location) {
  state.currentLocation = location;
  const levels = state.currentUpanishadData.structure_levels;
  const navLevels = levels.slice(0, -1);
  let titleParts = [state.currentUpanishadData.text_name];
  let dataToRender = state.currentUpanishadData.content;

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

  dom.mantraDisplay.innerHTML = "";
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
      dom.mantraDisplay.appendChild(itemContainer);
    });
  }

  dom.contentTitle.textContent = titleParts.join(" - ");
  updateUiState(location);
}

function showItemDetails(itemContainer, showMobilePane = true) {
  const selected = dom.mantraDisplay.querySelector(".selected");
  if (selected) selected.classList.remove("selected");
  itemContainer.classList.add("selected");

  itemContainer.scrollIntoView({ behavior: "smooth", block: "center" });

  let dataToFind = state.currentUpanishadData.content;
  const levels = state.currentUpanishadData.structure_levels;

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
    const newPath = buildPathFromContainer(itemContainer);
    if (window.location.hash !== `#${newPath}`) {
      history.replaceState(null, "", `#${newPath}`);
    }

    dom.commentaryText.innerHTML = itemData.commentary_text
      ? marked.parse(itemData.commentary_text)
      : "<p>No commentary available.</p>";
  }

  if (window.innerWidth <= 800 && showMobilePane) {
    openMobileOverlay(dom.commentaryPane);
  }
}

function updateUiState() {
  const activeLink = dom.navigatorContent.querySelector("a.active");
  if (activeLink) activeLink.classList.remove("active");

  const path = window.location.hash;
  const newLink = dom.navigatorContent.querySelector(`a[href="${path}"]`);

  if (newLink) {
    newLink.classList.add("active");
  } else {
    const sectionPath = path.slice(0, path.lastIndexOf("/"));
    const sectionLink = dom.navigatorContent.querySelector(
      `a[href="${sectionPath}"]`
    );
    if (sectionLink) sectionLink.classList.add("active");
  }

  document
    .querySelectorAll(".accordion-group")
    .forEach((el) => (el.open = false));
  const { level0 } = state.currentLocation;
  if (level0 !== undefined) {
    const activeAccordion = dom.navigatorContent.querySelector(
      `[data-level0="${level0}"]`
    );
    if (activeAccordion) activeAccordion.open = true;
  }
  updateArrowButtons();
}
function addEventListeners() {
  window.addEventListener("hashchange", handleRouteChange);

  dom.textSelector.addEventListener("change", (e) => {
    const newSlug = state.allTexts.find((t) => t.file === e.target.value).slug;
    window.location.hash = `/${newSlug}`;
  });

  dom.navigatorContent.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      closeMobileOverlays();
    }
  });

  dom.mantraDisplay.addEventListener("click", (e) => {
    const container = e.target.closest(".item-container");
    if (container) {
      const newPath = buildPathFromContainer(container);
      navigateTo(newPath);
    }
  });

  const navigateArrows = (direction) => {
    const { prev, next } = getAdjacentSections();
    const target = direction === "prev" ? prev : next;
    if (target) {
      const textSlug = state.currentText.slug;
      const navLevels = state.currentUpanishadData.structure_levels.slice(
        0,
        -1
      );
      let pathNumbers = [];
      let dataTraversal = state.currentUpanishadData.content;
      for (let i = 0; i < navLevels.length; i++) {
        const index = target[`level${i}`];
        const item = dataTraversal[index];
        pathNumbers.push(item.number);
        dataTraversal = item.children;
      }
      navigateTo(`/${textSlug}/${pathNumbers.join("/")}`);
    }
  };

  dom.prevBtn.addEventListener("click", () => navigateArrows("prev"));
  dom.nextBtn.addEventListener("click", () => navigateArrows("next"));

  dom.mobileNavToggle.addEventListener("click", () =>
    openMobileOverlay(dom.navigatorPane)
  );
  dom.mobileNavClose.addEventListener("click", closeMobileOverlays);
  dom.mobileCommentaryClose.addEventListener("click", closeMobileOverlays);
  dom.mobileOverlay.addEventListener("click", closeMobileOverlays);
}
function buildPathFromContainer(container) {
  const textSlug = state.currentText.slug;
  const levels = state.currentUpanishadData.structure_levels;
  let pathParts = [textSlug];
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

function updateArrowButtons() {
  const { prev, next } = getAdjacentSections();
  dom.prevBtn.disabled = !prev;
  dom.nextBtn.disabled = !next;
}

function getAdjacentSections() {
  const navLevels = state.currentUpanishadData.structure_levels.slice(0, -1);
  if (navLevels.length === 0) return { prev: null, next: null };

  let prev = { ...state.currentLocation };
  let next = { ...state.currentLocation };

  // This logic currently only supports 2 levels of navigation.
  // It can be generalized if deeper structures are needed.
  if (navLevels.length === 2) {
    const level0Index = state.currentLocation.level0;
    const level1Index = state.currentLocation.level1;
    const level0Array = state.currentUpanishadData.content;
    const level1Array = level0Array[level0Index].children;

    if (level1Index < level1Array.length - 1) {
      next.level1++;
    } else if (level0Index < level0Array.length - 1) {
      next.level0++;
      next.level1 = 0;
    } else {
      next = null;
    }

    if (level1Index > 0) {
      prev.level1--;
    } else if (level0Index > 0) {
      prev.level0--;
      const prevLevel1Array = level0Array[prev.level0].children;
      prev.level1 = prevLevel1Array.length - 1;
    } else {
      prev = null;
    }
    return { prev, next };
  }
  // Fallback for other structures (e.g., single level)
  return { prev: null, next: null };
}
