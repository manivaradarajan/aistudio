# PDF Workflow Automation

This repository provides a flexible, YAML-driven Python script (`workflow.py`) for automating PDF processing tasks. It leverages the Google Gemini API for advanced text extraction and conversational AI, alongside other utilities for text manipulation.

## Features

-   **Dynamic Workflow Definition:** Define complex multi-step workflows using a simple YAML configuration.
-   **PDF Text Extraction:** Extract text from PDFs using the Gemini API, allowing for intelligent content understanding.
-   **Text Transliteration:** Convert text between various scripts (e.g., Devanagari to Roman) using `aksharamukha`.
-   **AI Chat Integration:** Engage in multi-turn conversations with the Gemini API, incorporating document content and previous step outputs.
-   **Content Aggregation:** Combine content from multiple files within a workflow step for comprehensive AI processing.
-   **Caching Mechanism:** Avoid redundant processing with intelligent caching based on file modification times.
-   **Per-Page-Range Processing:** Split large PDFs into smaller, manageable sections and process each range independently.
-   **Global Workflow Execution:** Run workflows on entire PDF documents or general input files.

## Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/pdfsplit.git
    cd pdfsplit
    ```

2.  **Create a virtual environment and install dependencies:**
    ```bash
    python -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    ```

3.  **Google Gemini API Key:**
    Create a `.env` file in the root directory of the project and add your Gemini API key:
    ```
    GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
    ```

## Usage

The main script is `workflow.py`. It takes a YAML configuration file as input, which defines the steps of your processing workflow.

### Running a Workflow

```bash
python workflow.py <path_to_your_yaml_config> [--force]
```

-   `<path_to_your_yaml_config>`: Path to your YAML configuration file (e.g., `input.yaml`).
-   `--force`: Optional flag to force regeneration of all output files, bypassing the caching mechanism.

### Configuration (YAML Examples)

Workflows are defined in YAML files. Here are examples of common configurations:

#### 1. Per-Page-Range Processing

This mode is ideal for processing specific sections of a PDF. The `page_ranges` section defines how the PDF should be split and processed.

```yaml
pdf_file: tmk-sarvankasa.pdf
model: gemini-pro-vision # Or gemini-pro for text-only models
page_ranges:
  - page_range: "178-181"
    suffix: "sarire-aham-pratyaya"
  - page_range: "185-199"
    suffix: "dharma-dharmi-jnanayoh-svarupam"
  # ... more page ranges
workflow:
  - type: extract_text_from_pdf
    prompt: prompt-transcribe.txt
    output_extension: .txt
    output_suffix: transcribe
  - type: convert_script
    from: devanagari
    to: roman
    output_extension: .txt
    output_suffix: roman
  - type: chat
    model: gemini-pro # Use a text-only model for chat turns
    turns:
      - prompt: prompt-modern.txt
        output_extension: .md
        output_suffix: modern
      - prompt: prompt-summarize-collection.txt
        output_extension: .md
        output_suffix: summary
        fileset:
          include:
            - "*-modern.md"
          exclude: []
          global_search: false
```

**Explanation:**
-   `pdf_file`: The source PDF to be processed.
-   `model`: The default Gemini model to use for steps that interact with the API.
-   `page_ranges`: A list of page ranges. Each item can be a simple string (e.g., `"1-5"`) or an object with `page_range` and `suffix` for more descriptive output filenames.
-   `workflow`: A list of steps to execute for each page range.
    -   `extract_text_from_pdf`: Extracts text from the PDF using the specified `prompt` and saves it with the given `output_extension` and `output_suffix`.
    -   `convert_script`: Transliterates the text from one script (`from`) to another (`to`).
    -   `chat`: Initiates a multi-turn chat with the Gemini API.
        -   `turns`: Each item represents a turn in the conversation.
            -   `prompt`: The prompt file for the current turn.
            -   `output_extension`, `output_suffix`: For saving the chat response.
            -   `fileset`: (Optional) Specifies a set of files whose content should be concatenated and provided as additional context to the current chat turn.
                -   `include`, `exclude`: Glob patterns to select files.
                -   `global_search`: If `true`, searches across the entire `output` directory; otherwise, searches within the current run's prefixed files.

#### 2. Global Workflow Processing

This mode processes the entire `pdf_file` or runs a general workflow without splitting.

```yaml
pdf_file: dravya-adravya.pdf
run_name: dravya-adravya-full
model: gemini-pro-vision
workflow:
  - type: extract_text_from_pdf
    prompt: prompt-transcribe.txt
    output_extension: .txt
    output_suffix: transcribe
  # ... other steps as needed
```

**Explanation:**
-   `pdf_file`: The source PDF for the global workflow.
-   `run_name`: (Optional) A custom prefix for output files. If not provided, the PDF's stem is used.
-   `model`, `workflow`: Similar to per-page-range processing, but applied to the entire document.

### Example

To run the `input.yaml` workflow:

```bash
python workflow.py input.yaml
```

To force regeneration:

```bash
python workflow.py input.yaml --force
```