# YAML Workflow Syntax Documentation

This document details the syntax for the `input.yaml` file used to drive the dynamic, multi-step workflow engine.

## 1. Top-Level Structure

The `input.yaml` file is organized into several key sections:

```yaml
# Optional: Define default parameters for each step type
defaults:
  # ... see section 3.2

# Optional: Define reusable YAML snippets
step_definitions:
  # ... see section 6

# Global configuration settings for the entire run
pdf_file: my_document.pdf
model: gemini-2.5-pro
run_name: my-global-run # Used as a prefix in global mode

# Defines the sequence of processing steps
workflow:
  - # ... step definitions
```

- `defaults` (Optional): A section to define default parameters for different step types, reducing repetition.
- `step_definitions` (Optional): A place to define reusable YAML blocks using anchors (`&`).
- **Global Configuration**: Settings that apply to the entire workflow, such as `pdf_file` and the default `model`.
- `workflow`: A list of steps that define the processing pipeline.

## 2. Execution Modes

The workflow can run in two primary modes:

### 2.1. Per-Page-Range Mode

If a `page_ranges` key is defined, the script will split the source `pdf_file` and run the entire workflow on each specified range.

```yaml
pdf_file: my_document.pdf
page_ranges:
  # Simple range
  - '1-5'
  # Range with a custom suffix for output files
  - page_range: 10-12
    suffix: chapter-1
```

### 2.2. Global Mode

If `page_ranges` is omitted, the workflow runs only once. If a `pdf_file` is provided, it's used as the initial input. Otherwise, the workflow starts without any file input.

## 3. Workflow Steps

The `workflow` is a list of steps, each identified by a `type`.

### 3.1. Common Step Parameters

- `type`: (Required) The type of the step (e.g., `extract_text_from_pdf`, `chat`).
- `output_suffix`: A string to append to the output filename.
- `output_extension`: The file extension for the output file (e.g., `.txt`, `.md`).
- `model`: Overrides the global `model` for this specific step.

### 3.2. Default Parameters

To avoid repetition, you can define default parameters for each step type in the `defaults` section.

```yaml
defaults:
  extract_text_from_pdf:
    output_suffix: transcribed
    output_extension: '.txt'
  chat:
    model: gemini-1.5-flash

workflow:
  # This step will automatically use the output_suffix 'transcribed'
  - type: extract_text_from_pdf
    prompt: prompts/transcribe.txt
```

### 3.3. Step Types

#### `extract_text_from_pdf`

Extracts text from a PDF file using Gemini's multimodal capabilities.

```yaml
- type: extract_text_from_pdf
  prompt: prompts/transcribe.txt
  # Optional override for the model
  model: gemini-1.5-flash
```

#### `convert_script`

Transliterates the input text from one script to another using the `aksharamukha` library.

```yaml
- type: convert_script
  from: Devanagari
  to: IAST
```

#### `chat`

Initiates a conversation with the Gemini model. It can be a simple single-turn or a complex multi-turn chat.

**Simplified (Single-Turn) Syntax:**

```yaml
- type: chat
  prompt: prompts/summarize.txt
  output_extension: '.md'
```

**Multi-Turn Syntax:**

```yaml
- type: chat
  turns:
    - prompt: prompts/turn1.txt
    - prompt: prompts/turn2.txt
      # This turn will not include the initial PDF upload
      clear_uploads: true
      # Override the model for this specific turn
      model: gemini-1.5-flash
```

**Chat-Specific Parameters:**

- `clear_uploads` (boolean): If `true`, the initial file handle (e.g., from a PDF) is not included in this or subsequent turns.
- `context_files` (string): The ID of a fileset defined by a `gather_files` step. Its content will be included in the prompt.

#### `gather_files`

Collects a set of files based on glob patterns and stores them in the context with a given ID.

```yaml
- type: gather_files
  id: my_text_files
  base_dir: output # 'output' (default) or 'root'
  include:
    - '*-transcribed.txt'
    - '*-roman.txt'
  exclude:
    - '*-modern.txt'
```

- `id`: (Required) A unique identifier for this fileset.
- `base_dir`: The directory to search in. Defaults to `output`.
- `include` / `exclude`: Lists of glob patterns to match files.

#### `run_if`

Conditionally executes a nested list of steps. Currently supports `file_exists`.

```yaml
- type: run_if
  condition:
    file_exists: output/my-file.txt
  steps:
    # These steps will only run if 'output/my-file.txt' exists
    - type: chat
      prompt: prompts/process-file.txt
```

## 4. YAML Anchors for Reusability

You can use YAML's native anchor (`&`) and alias (`*`) features to define and reuse any part of your configuration.

```yaml
step_definitions:
  # Define a reusable chat turn
  modernize_turn: &modernize
    prompt: prompts/modernize.txt
    output_suffix: "modern"
    model: gemini-2.5-pro

workflow:
  - type: chat
    turns:
      - prompt: prompts/initial.txt
      # Use the alias to insert the predefined turn
      - *modernize
```
