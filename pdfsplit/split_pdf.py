
import argparse
from pathlib import Path
import sys

from pdf_utils import split_pdf

def main():
    """Main function for the split_pdf command-line tool."""
    parser = argparse.ArgumentParser(
        description="A simple tool to quickly extract a page range from a PDF file."
    )
    parser.add_argument(
        "source_pdf",
        type=Path,
        help="The path to the source PDF file."
    )
    parser.add_argument(
        "page_range",
        help="The page range to extract (e.g., '10-15', '21')."
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("output"),
        help="The directory to save the output file (defaults to 'output')."
    )

    args = parser.parse_args()

    if not args.source_pdf.exists():
        print(f"Error: Source PDF not found at '{args.source_pdf}'", file=sys.stderr)
        sys.exit(1)

    try:
        split_pdf(args.source_pdf, args.page_range, args.output_dir)
    except Exception as e:
        # The split_pdf function already logs the error, so we just exit.
        sys.exit(1)

if __name__ == "__main__":
    main()
