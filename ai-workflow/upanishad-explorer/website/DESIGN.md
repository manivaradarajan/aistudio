# Upanishad Explorer - Design & Architecture

This document outlines the overall design philosophy, architectural approach, and core principles for the Upanishad Explorer web application. It serves as a comprehensive guide for current and future development.

---

### 1. Overall Design Intent (The "Why")

The core intent is to create a **scholarly yet highly readable and accessible digital library** for sacred texts and their commentaries. The design prioritizes the content, aiming to provide a focused, distraction-free reading environment that is powerful for study but simple for casual reading.

This philosophy is guided by a few key principles:

- **Content-First:** The text is the "hero" of the application. The user interface—navigation, buttons, and panels—is designed to be clean, minimal, and secondary to the content it presents. It should feel like a tool that gets out of the way.

- **Progressive Disclosure:** The user is never overwhelmed. They are first presented with the primary text. Deeper information, like commentary, is revealed only upon explicit interaction (a click on a text item). The full table of contents is neatly organized into collapsible accordion sections.

- **Context is Key:** The design ensures the user never loses their place.

  - **On Desktop**, the three-pane layout (Navigator, Main Text, Commentary) keeps the table of contents, the selected scripture section, and its associated commentary visible simultaneously for cross-referencing.
  - **On Mobile**, overlays and bottom sheets are used instead of separate pages, so the user always feels grounded in the main text.

- **Responsive Duality:** The application serves two distinct use cases based on the device:
  - **Desktop as a Workbench:** The spacious, multi-pane layout, managed by `Split.js`, is optimized for research, comparison, and deep study.
  - **Mobile as a Reader:** The single-pane, focused layout with easy navigation (header arrows, slide-in navigator, pop-up commentary) is optimized for a linear, immersive reading experience.

---

### 2. High-Level Architectural Approach (The "How")

The application is architected as a **vanilla JavaScript Single-Page Application (SPA)** that dynamically renders content fetched from static JSON files. This approach is fast, secure, and easily deployable.

The architecture has four distinct pillars:

#### 2.1. Data Layer (The "Brain")

- **Source of Truth:** All textual content is stored in structured, generic JSON files. A root `texts.json` manifest file lists all available texts and points to their respective data files.

- **Hierarchy-Driven Presentation:** The content is completely separated from the presentation. The application's code has no hard-coded knowledge of any specific Upanishad. The structure of the navigation is determined entirely by the _hierarchy of the data itself_.

  - **The Rule:** If a data node has a `children` array, it is rendered as a collapsible accordion (`<details>`). If a node does _not_ have a `children` array, it is rendered as a clickable link (`<a>`).
  - **Example A (Flat):** For a text with `structure_levels: ["Mantra"]`, each mantra object in the `content` array has no `children`. The app renders a simple list of links.
  - **Example B (Hierarchical):** For a text with `structure_levels: ["Khanda", "Mantra"]`, the "Khanda" nodes have a `children` array containing mantras. The app renders "Khanda" nodes as accordions, and the "Mantra" nodes within them as links. This logic scales to any depth of nesting.

- **Generic Schema:** A recursive, node-based schema (`type`, `name`, `number`, `children`, `text`, `commentary_text`) allows the application to handle any text hierarchy. The `structure_levels` array primarily provides human-readable labels for each level of the hierarchy.

- **Lazy Loading:** The schema supports a `file` property on structural nodes to optimize initial load times. This allows sections of a text to be defined in separate JSON files and fetched on-demand.

#### 2.2. Structure Layer (The "Skeleton" - HTML)

- **Semantic Shell:** The `index.html` file is a minimal, semantic shell using `<nav>`, `<main>`, and `<aside>`. It acts as a stable "stage" with empty containers (`#navigator-content`, `#mantra-display`, etc.) that the JavaScript populates with content.
- **No Content:** The HTML contains no actual scriptural text, ensuring a clean separation of concerns.

#### 2.3. Presentation Layer (The "Look" - CSS)

- **Variable-Driven Theming:** All colors, fonts, and key spacing are defined as CSS Custom Properties (e.g., `--bg-color`). This makes implementing new themes (like a dark mode) trivial by toggling a class on the `<body>`.
- **Modern Layout:** It uses CSS Flexbox for its core layout, which is ideal for the `Split.js` library and responsive design.
- **Responsive Breakpoints:** A single, clear media query (`@media (max-width: 800px)`) cleanly separates the desktop and mobile styles, completely transforming the layout from a three-pane grid to a single-view overlay system.
- **Mobile Scrolling Solution:** Extra padding is added to the bottom of the main content pane on mobile (`#mantra-display`) to ensure that the `scrollIntoView({ block: 'center' })` JavaScript call can successfully center even the last item on the screen.

#### 2.4. Behavior Layer (The "Action" - JavaScript)

- **Centralized Hash-Based Routing:** The URL hash (`#/{text_slug}/{level_1_num}/{level_2_num...}`) is the **single source of truth** for the application's state. All user actions (clicking links, arrows, dropdowns) modify the hash.

- **Unidirectional & Resilient Data Flow:** A `hashchange` event listener is the primary driver. It calls a single `handleRouteChange` function, which acts as a central controller that:

  1.  Parses the URL.
  2.  **Handles Race Conditions:** Implements a request-stamping mechanism to prevent asynchronous rendering functions from finishing out of order during rapid navigation, thus eliminating content "flashing". It achieves this by issuing a unique `navigationRequestId` for each route change and having the rendering function yield to the event loop (`await Promise.resolve()`) before checking if its ID is still the most recent one.
  3.  Loads the correct data (including lazy-loaded files).
  4.  Calls generic rendering functions (`renderNavigator`, `renderSectionItems`) to build the DOM.

- **State Management:** A simple global `_state` object (managed via `js/state.js`) caches loaded data and tracks the application's status. Key properties include `allTexts`, `currentTextSlug`, `dataMap` (an ID-to-node lookup for fast access), and `navigationRequestId` (for race condition handling).

- **Generic Navigation Logic:** The navigation renderer (`createNavElement`) and the arrow button logic (`navigateArrows`) are written to be data-agnostic. They operate on the data's hierarchical structure, not on hard-coded assumptions about any specific text.

---

### 3. Constants Expected Across Refactors (The "Guiding Principles")

These are the core architectural decisions that must remain constant to ensure the project remains scalable and maintainable.

1.  **The Schema is the Contract:** All code will be written to conform to the generic JSON schema. To support a new text or change its presentation hierarchy, you modify the **data's structure (JSON)**, not the application code. The presence or absence of a `children` array on a node is the primary driver of the UI.

2.  **The URL is State:** The application is functionally stateless. Any view can be perfectly reconstructed just from the URL. All navigation actions must result in a URL hash change.

3.  **Generic Before Specific:** Functions will continue to be written generically. Instead of `loadAnuvaka`, we have `loadAndRenderSection`. Instead of `.mantra-container`, we use `.item-container`. This is the key to scalability.

4.  **Separation of Concerns:** HTML (structure), CSS (style), JavaScript (behavior), and JSON (content) will remain in their own separate files. DOM elements are built programmatically in JavaScript for security and maintainability.

5.  **User Experience is Paramount:** Features should be implemented with both desktop (study) and mobile (reading) use cases in mind. Bug fixes, like mobile scrolling issues or race condition flashes, should be prioritized as they directly impact the core reading experience.
