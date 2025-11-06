# Upanishad Explorer - Design & Architecture

This document outlines the overall design philosophy, architectural approach, and core principles for the Upanishad Explorer web application. It serves as a comprehensive guide for current and future development, making the codebase more accessible for both human and LLM developers.

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

- **Canonical Library:** The master source of truth is a set of JSON files (`library-internal.json`, `library-external.json`) that define every text the application is aware of. This "library" lists each text's canonical slug, display names, and a list of aliases to handle inconsistent references.

- **Hierarchy-Driven Presentation:** The content is completely separated from the presentation. The application's code has no hard-coded knowledge of any specific Upanishad. The structure of the navigation and titles is determined entirely by the _hierarchy of the data itself_.

- **Data-Driven UI Labels:** The `structure_levels` array in each text's JSON file is an array of objects, containing not just a `key` (e.g., "Valli") but also its display names in various scripts (`scriptNames`). This removes hardcoded labels from the application code and makes each text self-describing.

- **Semantic and Decoupled References:** Citations within the commentary text are not hardcoded URLs. They use a special, abstract format (`[Display Text](ref:slug/path)`). This decouples the reference from the application's routing implementation. A client-side resolver (`handleReferenceClick`) parses these semantic links and translates them into the appropriate action.

- **Lazy Loading:** The schema supports a `file` property on structural nodes to optimize initial load times. This allows sections of a text to be defined in separate JSON files and fetched on-demand.

#### 2.2. Structure Layer (The "Skeleton" - HTML & Types)

- **Semantic Shell:** The `index.html` file is a minimal, semantic shell using `<nav>`, `<main>`, and `<aside>`. It acts as a stable "stage" with empty containers (`#navigator-content`, `#mantra-display`, etc.) that the JavaScript populates with content.

- **JSDoc-Based Type System:** To improve code clarity and maintainability, the project uses a JSDoc-based type system. A central `js/types.js` file defines the core data structures (`UpanishadNode`, `LibraryEntry`, `AppState`, etc.). This provides a clear "schema" for the data and function signatures, which is invaluable for both human and LLM developers.

#### 2.3. Presentation Layer (The "Look" - CSS)

- **Variable-Driven Theming:** All colors, fonts, and key spacing are defined as CSS Custom Properties (e.g., `--bg-color`). This makes implementing new themes (like a dark mode) trivial.

- **Modern Layout:** It uses CSS Flexbox for its core layout, which is ideal for the `Split.js` library and responsive design.

- **Responsive Breakpoints:** A single, clear media query (`@media (max-width: 800px)`) cleanly separates the desktop and mobile styles, completely transforming the layout from a three-pane grid to a single-view overlay system.

#### 2.4. Behavior Layer (The "Action" - JavaScript)

- **Modular & Event-Driven:** The JavaScript is organized into modules with specific responsibilities (e.g., `api.js`, `router.js`, `state.js`, and UI modules in `js/ui/`). The application is primarily event-driven, with a central `app.js` that initializes the application and attaches event listeners.

- **Centralized Hash-Based Routing:** The URL hash (`#/{text_slug}/{level_1_num}/{level_2_num...}`) is the **single source of truth** for the application's state. All user actions that change the content view modify the hash.

- **Unidirectional & Resilient Data Flow:** A `hashchange` event listener is the primary driver. It calls a single `handleRouteChange` function, which acts as a central controller that:

  1.  Parses the URL.
  2.  **Handles Race Conditions:** Implements a request-stamping mechanism (`navigationRequestId`) to prevent asynchronous rendering functions from finishing out of order during rapid navigation.
  3.  Loads the correct data (including lazy-loaded files).
  4.  Calls generic rendering functions to build the DOM.

- **State Management:** A simple global `_state` object (managed via `js/state.js`) caches loaded data and tracks the application's status. A single `updateState` function can be used for more complex state transitions, making state changes more predictable.

---

### 3. Constants Expected Across Refactors (The "Guiding Principles")

1.  **The Schema is the Contract:** All code will be written to conform to the generic JSON schema and the JSDoc types defined in `js/types.js`. To support a new text or change its presentation hierarchy, you modify the **data's structure (JSON)**, not the application code.

2.  **The URL is State:** The application is functionally stateless. Any view can be perfectly reconstructed just from the URL. All navigation actions must result in a URL hash change.

3.  **Data is Decoupled:**
    - **Content:** The JSON data for texts contains the content and its structure, but no presentation logic.
    - **References:** References within the data are semantic (`ref:slug/path`), not presentational (`href="#/slug/path"`).

4.  **Generic Before Specific:** Functions will continue to be written generically. Instead of `loadAnuvaka`, we have `renderContentForRoute`. Instead of `.mantra-container`, we use `.item-container`. This is the key to scalability.

5.  **Separation of Concerns:** HTML (structure), CSS (style), JavaScript (behavior), and JSON (content) will remain in their own separate files. The data layer is the single source of truth for all content.