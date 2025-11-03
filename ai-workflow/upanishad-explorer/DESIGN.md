# Upanishad Explorer - Design & Architecture

This document outlines the overall design philosophy, architectural approach, and core principles for the Upanishad Explorer web application. It serves as a guide for current and future development.

---

### 1. Overall Design Intent (The "Why")

The core intent is to create a **scholarly yet highly readable and accessible digital library** for sacred texts and their commentaries. The design prioritizes the content itself, aiming to provide a focused, distraction-free reading environment that is powerful for study but simple for casual reading.

This philosophy is guided by a few key principles:

- **Content-First:** The text is the "hero" of the application. The user interface—navigation, buttons, and panels—is designed to be clean, minimal, and secondary to the content it presents. It should feel like a tool that gets out of the way.

- **Progressive Disclosure:** The user is never overwhelmed. They are first presented with the primary text. Deeper information, like commentary, is revealed only upon explicit interaction (a click on a text item). Similarly, the full table of contents is neatly organized into collapsible accordion sections.

- **Context is Key:** The design ensures the user never loses their place.

  - **On desktop**, the three-pane layout (Navigator, Main Text, Commentary) keeps the table of contents, the selected scripture section, and its associated commentary visible simultaneously, allowing for easy cross-referencing and study.
  - **On mobile**, overlays and bottom sheets are used instead of separate pages, so the user always feels grounded in the main text they are reading.

- **Responsive Duality:** The application serves two distinct use cases based on the device:
  - **Desktop as a Workbench:** The spacious, multi-pane layout, managed by `Split.js`, is optimized for research, comparison, and deep study.
  - **Mobile as a Reader:** The single-pane, focused layout with easy navigation (header arrows, slide-in navigator, pop-up commentary) is optimized for a linear, immersive reading experience.

---

### 2. High-Level Architectural Approach (The "How")

The application is architected as a **vanilla JavaScript Single-Page Application (SPA)** that dynamically renders content fetched from static JSON files. This approach is fast, secure, and easy to deploy on any static hosting service (like GitHub Pages).

The architecture has four distinct pillars:

1.  **Data Layer (The "Brain"):**

    - **Source of Truth:** All textual content is stored in structured, generic JSON files. A root `texts.json` manifest file lists all available texts and points to their respective data files.
    - **Decoupling:** The content is completely separated from the presentation. The application's code has no hard-coded knowledge of any specific Upanishad; it only knows how to read the JSON schema.
    - **Generic Schema:** A recursive, node-based schema (`type`, `name`, `number`, `children`, `text`) allows the application to handle any text hierarchy by reading the `structure_levels` metadata within each text's JSON file.
    - **Lazy Loading:** To optimize initial load times for large texts, the schema supports a `file` property on structural nodes. This allows sections of a text to be defined in separate JSON files and fetched on-demand when the user navigates to them.

2.  **Structure Layer (The "Skeleton" - HTML):**

    - **Semantic Shell:** The `index.html` file is a minimal, semantic shell using `<nav>`, `<main>`, and `<aside>`. It acts as a stable "stage" with empty containers that the JavaScript populates with content.
    - **No Content:** The HTML contains no actual scriptural text, ensuring a clean separation of concerns.

3.  **Presentation Layer (The "Look" - CSS):**

    - **Variable-Driven Theming:** All colors, fonts, and key spacing are defined as CSS Custom Properties (e.g., `--bg-color`). This makes implementing new themes (like a dark mode) trivial.
    - **Modern Layout:** It uses CSS Flexbox for its core layout, which is ideal for the `Split.js` library and responsive design.
    - **Responsive Breakpoints:** A single, clear media query (`@media (max-width: 800px)`) cleanly separates the desktop and mobile styles, completely transforming the layout from a three-pane grid to a single-view overlay system.

4.  **Behavior Layer (The "Action" - JavaScript):**
    - **Centralized Hash-Based Routing:** The URL hash (`#/...`) is the **single source of truth** for the application's state. All user actions (clicking links, arrows, dropdowns) modify the hash.
    - **Single Event Listener:** A `hashchange` event listener is the primary driver of the application. It calls a single `handleRouteChange` function.
    - **Rendering Engine:** The `handleRouteChange` function acts as a central controller that parses the URL, loads the correct data (including lazy-loaded files), caches it, and calls generic rendering functions (`renderNavigator`, `loadSection`) to build the DOM. This creates a predictable, unidirectional data flow.
    - **State Management:** A global `state` object caches the current text, the user's location, and loaded data sections to prevent redundant network requests.

---

### 3. Constants Expected Across Refactors (The "Guiding Principles")

These are the core architectural decisions that should remain constant to ensure the project remains scalable and maintainable.

1.  **The Schema is the Contract:** All code will be written to conform to the generic JSON schema, including its support for nested structures and lazy loading. To support a new text, you modify the **data**, not the application code.

2.  **The URL is State:** The application is functionally stateless. Any view can be perfectly reconstructed just from the URL. All navigation actions must result in a URL hash change.

3.  **Generic Before Specific:** Functions will continue to be written generically. Instead of `loadAnuvaka`, we have `loadSection`. Instead of `.mantra-container`, we use the more abstract `.item-container`. This is the key to scalability.

4.  **Separation of Concerns:** HTML (structure), CSS (style), JavaScript (behavior), and JSON (content) will remain in their own separate files. We will continue to build DOM elements programmatically in JavaScript for security and maintainability.
