# Upanishad Explorer - Project Roadmap

This document outlines the roadmap for evolving the Upanishad Explorer from its current state into a scalable, feature-rich digital library for Vedic studies.

---

## Text

[ ] Is Mundaka 1.1.7 spurious? Copy of Svetasvatara sloka? http://localhost:8000/#/mundaka/1/1/7

## Phase 3: Core UX Polish & Accessibility

_Goal: Implement high-impact features that make the application more professional, accessible, and comfortable for long study sessions. These are foundational improvements._

- [ ] **Implement Font Size Control:** (High Priority)

  - [ ] Add "+" and "-" buttons to the main header UI for font size adjustment.
  - [ ] Use JavaScript to modify a root CSS variable (e.g., `--base-font-size`) or add/remove classes on the `<body>` element.
  - [ ] Ensure the font size change applies to the navigator, main text, and commentary panes.
  - [ ] Persist the user's preference in `localStorage`.

- [ ] **Implement Theme Switcher:**

  - [ ] Add a toggle button (e.g., a sun/moon icon) to the UI.
  - [ ] Create CSS variable sets for `light-mode` (default), `dark-mode`, and a `sepia-mode` for readability.
  - [ ] Use JavaScript to toggle a class on the `<body>` element.
  - [ ] Persist the theme choice in `localStorage`.

- [ ] **Add an "About / Sources" Page/Modal:**

  - [ ] Create a simple modal or a dedicated page.
  - [ ] Add a link to it (e.g., in the navigator pane).
  - [ ] Detail the source editions for the texts and commentaries used, to enhance academic credibility.

- [ ] **Improve Accessibility (WCAG Compliance):**

  - [ ] Add `aria-label` attributes to all icon-only buttons (menu, close, arrows) for screen readers.
  - [ ] Ensure a logical tab order for keyboard navigation.
  - [ ] Check color contrast ratios, especially for the new themes.

- [ ] **Add a "Copy Verse" Feature:**
  - [ ] Add a small copy icon that appears on hover next to each mantra number in the main pane.
  - [ ] On click, copy the mantra number and its text to the clipboard for easy citation.

---

## Phase 4: Scholarly Feature Expansion

_Goal: Introduce powerful tools for deeper academic and traditional study, transforming the reader into an interactive research environment._

- [ ] **Support Multiple Text & Commentary Views:** (Major Feature)

  - [ ] **Schema Update:** Modify the JSON schema. The `commentary_text` could become an array of objects (e.g., `{"commentator": "Śaṅkara", "text": "..."}`). The main text could also have alternates (`"text_iast": "..."`, `"translation_en": "..."`).
  - [ ] **UI Update:**
    - In the **main pane**, add tabs or a dropdown to switch between Devanagari, IAST, and English Translation.
    - In the **commentary pane**, add a dropdown to select different commentators.

- [ ] **Implement Search Functionality:**

  - [ ] Add a search input field to the navigator pane.
  - [ ] **Client-Side Search:** For the current implementation, write JS to search the `currentUpanishadData` object.
  - [ ] Display results as a list of clickable links that navigate to the relevant mantra.
  - [ ] _Future Scope:_ Allow searching across all texts or filtering search to main text vs. commentary.

- [ ] **Make Markdown Links Functional:**

  - [ ] **Event Delegation:** Add a global click handler on the commentary pane that intercepts clicks on `<a>` tags with a `/reference/` path.
  - [ ] **Parsing:** Parse the link text (e.g., "ब्र.सू.४-१-१") and `href` to identify the reference.
  - [ ] **MVP Implementation:** Open a simple modal that displays the parsed reference (e.g., "Reference to: Brahma Sūtra 4.1.1").
  - [ ] _Future Scope:_ Create a separate data store for these references and fetch/display the actual text of the referenced sūtra.

- [ ] **Add Pedagogical Tools (_Padaccheda_ & _Anvaya_):**

  - [ ] **Schema Update:** Add optional `padaccheda` and `anvaya` fields to the mantra objects in the JSON.
  - [ ] **UI Update:** Add toggle buttons or icons in the main pane to show/hide these alternative text views below each mantra.

- [ ] **Refine Highlighting for Merged Sections (like Taittiriya):**
  - [ ] When a section displays multiple mantras in one block, make the inline numbers (e.g., `1.`, `2.`) clickable.
  - [ ] On click, scroll the commentary pane to the corresponding `### मन्त्रः X` heading.

---

## Phase 5: Long-Term & Advanced Features

_Goal: Plan for major platform-level features that would require a backend and significantly expand the application's scope._

- [ ] **Implement Interactive Glossary/Dictionary:**

  - [ ] Create a separate JSON data file for a glossary of key terms.
  - [ ] Update the rendering logic to wrap key terms in a special tag (e.g., `<span class="term" data-key="brahman">`).
  - [ ] On click, display the glossary entry in a pop-up/tooltip.

- [ ] **User Accounts & Personalization:**

  - [ ] Requires a backend and database.
  - [ ] Allow users to create accounts.
  - [ ] Implement features like creating personal notes, bookmarking verses, and highlighting text.

- [ ] **Handle Commentary Subheadings:**
  - [ ] The generated JSON includes subheadings like `[प्रकाशिका]`.
  - [ ] Update the Markdown rendering (possibly with a custom `marked.js` renderer) to style these appropriately as distinct sections in the commentary pane.
