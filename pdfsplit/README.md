# PDF Page Extractor

A simple Python script to extract specific pages or page ranges (e.g., "2-5, 8, 10-12") from a PDF file and save them as a new PDF.

This script runs on macOS, Windows, and Linux.

## Requirements

  * Python 3.x
  * `pypdf` library

## Installation

Before running the script, you must install the `pypdf` library.

Open your terminal and run:

```bash
pip install pypdf
```

## How to Use

Save the script as `extract_pages_multi.py`. You can then run it directly from your terminal.

The script requires three arguments:

1.  **Input PDF:** The path to the source PDF file you want to extract pages from.
2.  **Output PDF:** The name you want to give the new, extracted PDF file.
3.  **Page Ranges:** A string, enclosed in quotes, that specifies which pages to extract.

### Command-Line Syntax

```bash
python extract_pages_multi.py <input.pdf> <output.pdf> "<page_ranges>"
```

### Page Range Format

The page range string is flexible:

  * **Single pages:** `5`
  * **A range:** `3-7` (extracts pages 3, 4, 5, 6, and 7)
  * **A mix:** `"2-5, 8, 10-12"` (extracts pages 2, 3, 4, 5, 8, 10, 11, and 12)

**Note:** You must wrap the page range string in quotes (`" "`) for the terminal to treat it as a single argument.

## Examples

### Example 1: Extract a single range

To extract pages 5 through 10 from `my_report.pdf` and save them as `chapter_1.pdf`:

```bash
python extract_pages_multi.py my_report.pdf chapter_1.pdf "5-10"
```

### Example 2: Extract multiple ranges and single pages

To extract pages 1, 3, 4, 5, and 9 from `manual.pdf` and save them as `manual_subset.pdf`:

```bash
python extract_pages_multi.py manual.pdf manual_subset.pdf "1, 3-5, 9"
```

### Example 3: Extract non-sequential pages

To extract only the first and last pages (e.g., from a 50-page document) and save as `cover_pages.pdf`:

```bash
python extract_pages_multi.py my_document.pdf cover_pages.pdf "1, 50"
```