## Prompt for AI Coding Agents

---

## SYSTEM CONTEXT

You are helping maintain the **Upanishad Explorer**, a web-based reader for sacred texts. The system uses:

- Generic JSON schema for all texts: text_schema.json
- Vanilla JavaScript SPA with hash-based routing
- Three-pane layout (navigator, text, commentary)
- Markdown-enhanced commentary with cross-references

You can see current state of the website in the "website" directory.

**Core Principle:** To add a new text, you should only modify DATA files, never application code.

---

## YOUR TASK

Add new Upanishads to the Explorer by analyzing source files and creating the necessary workflow files.

---

## INPUTS YOU'LL RECEIVE

**A single directory path** containing the Upanishad source files:

```
input-files/[upanishad-name]/
```

**Examples of directory structures you might see:**

```
# Short upanishad (single file):
input-files/isavasya/
└── isavasya-upanishad-commentary.md

# Multi-file upanishad (split by chapter):
input-files/taittiriya/
├── taittiriya-shikshavalli.md
├── taittiriya-anandavalli.md
└── taittiriya-bhriguvalli.md

# Multi-file upanishad (split by sections):
input-files/brihadaranyaka/
├── brihadaranyaka-adhyaya-1.md
├── brihadaranyaka-adhyaya-2.md
├── brihadaranyaka-adhyaya-3.md
├── brihadaranyaka-adhyaya-4.md
├── brihadaranyaka-adhyaya-5.md
└── brihadaranyaka-adhyaya-6.md
```

**You must infer everything from the files themselves. No human input.**

If you are confused, ask for confirmation.

---

## STEP-BY-STEP EXECUTION

### STEP 1: DISCOVER AND ANALYZE SOURCE FILES

'taittiriya' is a working successful end-to-end example of a multi-file input upanishad.
'isavasya' is a working successful end-to-end example if a single-file input upanishad.

**Instruction:**

For each upanishad, in the current directory, read all markdown files for the upanishad in the input directory and create here:

- prompt-task-<upanishad>.txt files
- <upanishad>-bhashya-to-json.yaml
