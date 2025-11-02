// app.js (With Mobile Scroll Lock Fix)

let upanishadData = [];
let currentLocation = { valli: 0, anuvaka: 0 };

// --- DOM Element References ---
const bodyEl = document.body; // Reference to the body
const navigatorPane = document.getElementById("nav-pane");
const commentaryPane = document.getElementById("commentary-pane");
const navigatorContent = document.getElementById("navigator-content");
const contentTitle = document.getElementById("content-title");
const mantraDisplay = document.getElementById("mantra-display");
const commentaryText = document.getElementById("commentary-text");
const mobileNavToggle = document.getElementById("mobile-nav-toggle");
const mobileNavClose = document.getElementById("mobile-nav-close");
const mobileCommentaryClose = document.getElementById(
  "mobile-commentary-close"
);
const mobileOverlay = document.getElementById("mobile-overlay");
const prevAnuvakaBtn = document.getElementById("prev-anuvaka");
const nextAnuvakaBtn = document.getElementById("next-anuvaka");

// --- Main Initialization ---
document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    const response = await fetch("taittiriya-upanishad-commentary.json");
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    upanishadData = await response.json();

    renderNavigator();
    addEventListeners();
    loadAnuvaka(currentLocation.valli, currentLocation.anuvaka);

    const firstMantra = mantraDisplay.querySelector(".mantra-container");
    if (firstMantra) {
      showMantraDetails(firstMantra, false);
    }

    if (window.innerWidth > 800) {
      Split(["#nav-pane", "#main-pane", "#commentary-pane"], {
        sizes: [20, 45, 35],
        minSize: [200, 300, 300],
        gutterSize: 2,
        cursor: "col-resize",
      });
    }
  } catch (error) {
    console.error("Failed to load or process data:", error);
    navigatorContent.innerHTML = `<p style="color: red;">Error loading data.</p>`;
  }
}

// --- NEW HELPER FUNCTIONS FOR MOBILE OVERLAYS ---
function openMobileOverlay(pane) {
  pane.classList.add("active");
  mobileOverlay.classList.add("active");
  bodyEl.classList.add("mobile-overlay-active"); // Lock background scroll
}

function closeMobileOverlays() {
  navigatorPane.classList.remove("active");
  commentaryPane.classList.remove("active");
  mobileOverlay.classList.remove("active");
  bodyEl.classList.remove("mobile-overlay-active"); // Unlock background scroll
}

// --- Logic and Rendering Functions --- (showMantraDetails is updated)
function showMantraDetails(mantraContainer, showMobilePane = true) {
  const selected = mantraDisplay.querySelector(".selected");
  if (selected) selected.classList.remove("selected");
  mantraContainer.classList.add("selected");
  mantraContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });

  const { valli, anuvaka, mantra } = mantraContainer.dataset;
  const mantraData =
    upanishadData[parseInt(valli)]?.anuvakas[parseInt(anuvaka)]?.mantras[
      parseInt(mantra)
    ];

  if (mantraData && mantraData.commentary_text) {
    commentaryText.innerHTML = marked.parse(mantraData.commentary_text);
  } else {
    commentaryText.innerHTML =
      "<p>No commentary available for this selection.</p>";
  }

  // UPDATED: Use the new helper function
  if (window.innerWidth <= 800 && showMobilePane) {
    openMobileOverlay(commentaryPane);
  }
}

// --- Event Listeners --- (Updated to use new helpers)
function addEventListeners() {
  navigatorContent.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (link) {
      e.preventDefault();
      const { valli, anuvaka } = link.dataset;
      loadAnuvaka(parseInt(valli), parseInt(anuvaka));
      const firstMantra = mantraDisplay.querySelector(".mantra-container");
      if (firstMantra) showMantraDetails(firstMantra, false);
      closeMobileOverlays(); // Use helper
    }
  });

  mantraDisplay.addEventListener("click", (e) => {
    const container = e.target.closest(".mantra-container");
    if (container) showMantraDetails(container);
  });

  const navigate = (direction) => {
    const { prev, next } = getAdjacentAnuvakas();
    const target = direction === "prev" ? prev : next;
    if (target) {
      loadAnuvaka(target.valli, target.anuvaka);
      const firstMantra = mantraDisplay.querySelector(".mantra-container");
      if (firstMantra) showMantraDetails(firstMantra, false);
    }
  };

  prevAnuvakaBtn.addEventListener("click", () => navigate("prev"));
  nextAnuvakaBtn.addEventListener("click", () => navigate("next"));

  // UPDATED: All mobile listeners now use the helpers
  mobileNavToggle.addEventListener("click", () =>
    openMobileOverlay(navigatorPane)
  );
  mobileNavClose.addEventListener("click", closeMobileOverlays);
  mobileCommentaryClose.addEventListener("click", closeMobileOverlays);
  mobileOverlay.addEventListener("click", closeMobileOverlays);
}

// --- Other functions (No changes needed) ---
function renderNavigator() {
  // ... same as before
  navigatorContent.innerHTML = "";
  upanishadData.forEach((valli, valliIndex) => {
    const valliGroup = document.createElement("details");
    valliGroup.className = "valli-group";
    valliGroup.dataset.valliIndex = valliIndex;
    const valliTitle = document.createElement("summary");
    valliTitle.textContent = valli.valli_name;
    valliGroup.appendChild(valliTitle);
    const anuvakaList = document.createElement("ul");
    valli.anuvakas.forEach((anuvaka, anuvakaIndex) => {
      const listItem = document.createElement("li");
      const link = document.createElement("a");
      link.href = "#";
      link.textContent = `अनुवाकः ${anuvaka.anuvaka_number}`;
      link.dataset.valli = valliIndex;
      link.dataset.anuvaka = anuvakaIndex;
      listItem.appendChild(link);
      anuvakaList.appendChild(listItem);
    });
    valliGroup.appendChild(anuvakaList);
    navigatorContent.appendChild(valliGroup);
  });
}
function loadAnuvaka(valliIndex, anuvakaIndex) {
  // ... same as before
  currentLocation = { valli: valliIndex, anuvaka: anuvakaIndex };
  const valli = upanishadData[valliIndex];
  const anuvaka = valli?.anuvakas[anuvakaIndex];
  if (!anuvaka) return;
  document.querySelectorAll(".valli-group").forEach((el) => (el.open = false));
  const activeValliGroup = navigatorContent.querySelector(
    `.valli-group[data-valli-index="${valliIndex}"]`
  );
  if (activeValliGroup) activeValliGroup.open = true;
  const activeLink = navigatorContent.querySelector("a.active");
  if (activeLink) activeLink.classList.remove("active");
  const newLink = navigatorContent.querySelector(
    `a[data-valli="${valliIndex}"][data-anuvaka="${anuvakaIndex}"]`
  );
  if (newLink) newLink.classList.add("active");
  contentTitle.textContent = `${valli.valli_name} - अनुवाकः ${anuvaka.anuvaka_number}`;
  mantraDisplay.innerHTML = "";
  anuvaka.mantras.forEach((mantra, mantraIndex) => {
    const mantraContainer = document.createElement("div");
    mantraContainer.className = "mantra-container";
    Object.assign(mantraContainer.dataset, {
      valli: valliIndex,
      anuvaka: anuvakaIndex,
      mantra: mantraIndex,
    });
    const numberEl = document.createElement("p");
    numberEl.className = "mantra-number";
    numberEl.textContent = mantra.mantra_number;
    const textEl = document.createElement("p");
    textEl.className = "mantra-text";
    textEl.textContent = mantra.mantra_text;
    mantraContainer.appendChild(numberEl);
    mantraContainer.appendChild(textEl);
    mantraDisplay.appendChild(mantraContainer);
  });
  commentaryText.innerHTML = "<p>Select a mantra to see its commentary.</p>";
  updateArrowButtons();
}
function updateArrowButtons() {
  // ... same as before
  const { prev, next } = getAdjacentAnuvakas();
  prevAnuvakaBtn.disabled = !prev;
  nextAnuvakaBtn.disabled = !next;
}
function getAdjacentAnuvakas() {
  // ... same as before
  const { valli, anuvaka } = currentLocation;
  let prev = null,
    next = null;
  if (anuvaka > 0) {
    prev = { valli, anuvaka: anuvaka - 1 };
  } else if (valli > 0) {
    prev = {
      valli: valli - 1,
      anuvaka: upanishadData[valli - 1].anuvakas.length - 1,
    };
  }
  if (anuvaka < upanishadData[valli].anuvakas.length - 1) {
    next = { valli, anuvaka: anuvaka + 1 };
  } else if (valli < upanishadData.length - 1) {
    next = { valli: valli + 1, anuvaka: 0 };
  }
  return { prev, next };
}
