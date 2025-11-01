#!/usr/bin/env python3
"""
A command-line wrapper script to split pages from a PDF file.

This script uses the existing split_pdf function from the workflow engine
to provide a simple, standalone tool for PDF manipulation.
"""

import argparse
import logging
import sys
from pathlib import Path

from workflow_engine.file_utils import split_pdf, compress_pdf

def main():
    """Main function to parse arguments and call the PDF splitter."""
    # --- Basic Setup ---
    logging.basicConfig(
        level=logging.INFO,
        format="[%(levelname)s] %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)]
    )

    parser = argparse.ArgumentParser(
        description="A tool to split a page range from a PDF file. Output is compressed by default.",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("source_pdf", help="The path to the source PDF file.")
    parser.add_argument(
        "--page-range", 
        required=True, 
        help="The page range to extract (e.g., '1-5', '10', '35,36-38')."
    )
    parser.add_argument(
        "--suffix", 
        help="An optional suffix to add to the output filename."
    )
    parser.add_argument(
        "--output-directory",
        default='.',
        help="The directory to save the output file (defaults to the current directory)."
    )
    parser.add_argument(
        "--no-compress",
        dest="compress",
        action="store_false",
        help="Do not compress the output PDF. Compression is enabled by default."
    )
    
    args = parser.parse_args()

    source_path = Path(args.source_pdf)
    if not source_path.is_file():
        logging.error(f"Source file not found: {source_path}")
        sys.exit(1)

    output_dir = Path(args.output_directory)

    try:
        # The split_pdf function creates a file with a default name, e.g., 'file-1-5.pdf'
        # It returns the path to this newly created file.
        temp_output_path = split_pdf(source_path, args.page_range, output_dir)

        final_path = temp_output_path

        # If a suffix is provided, rename the file to include it.
        if args.suffix:
            new_stem = f"{source_path.stem}-{args.page_range}-{args.suffix}"
            final_path = temp_output_path.with_stem(new_stem)
            
            logging.info(f"Suffix provided. Renaming output to: {final_path.name}")
            temp_output_path.rename(final_path)

        # By default, compress the output PDF.
        if args.compress:
            compress_pdf(final_path)

        logging.info(f"\nSuccessfully created split PDF: {final_path}")

    except (ValueError, IndexError) as e:
        logging.error(f"Error processing PDF: {e}")
        sys.exit(1)
    except Exception as e:
        logging.error(f"An unexpected error occurred: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()