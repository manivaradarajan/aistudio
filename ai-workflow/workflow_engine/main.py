import argparse
import logging
import sys
from pathlib import Path

import google.generativeai as genai
import yaml

from .engine import _process_page_ranges, run_workflow
from .gemini_utils import get_gemini_api_key
from .file_utils import OUTPUT_DIR

# --- Configuration ---
logging.basicConfig(
    level=logging.INFO,
    format="[%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)

def main():
    """
    The main entry point for the dynamic PDF processing workflow.
    """
    parser = argparse.ArgumentParser(description="A dynamic, YAML-driven PDF processing script.")
    parser.add_argument("yaml_file", help="Path to the YAML configuration file.")
    parser.add_argument("--force", action="store_true", help="Force regeneration of all files.")
    args = parser.parse_args()

    logging.info("===============================================")
    logging.info("=== Starting Dynamic PDF Processing Workflow ===")
    logging.info("===============================================")
    try:
        if args.force:
            logging.warning("FORCE flag is active. All files will be regenerated.")
        
        genai.configure(api_key=get_gemini_api_key())
        logging.info("Gemini API configured.")
        
        OUTPUT_DIR.mkdir(exist_ok=True)
        logging.info(f"Output directory is '{OUTPUT_DIR}'.")

        with open(args.yaml_file, 'r') as f:
            config = yaml.safe_load(f)
        logging.info(f"Configuration loaded from '{args.yaml_file}'.")

        if "page_ranges" in config and config["page_ranges"]:
            if "pdf_file" not in config:
                raise ValueError("'pdf_file' key is required in the YAML when 'page_ranges' is defined.")
            source_pdf_path = Path(config["pdf_file"])
            _process_page_ranges(config, source_pdf_path, args.force)
        else:
            logging.info("No 'page_ranges' found. Executing in 'global' mode.")
            
            source_pdf_path = Path(config["pdf_file"]) if "pdf_file" in config else Path()
            if "pdf_file" in config and not source_pdf_path.exists():
                 raise FileNotFoundError(f"Source PDF '{source_pdf_path}' not found.")

            run_name = config.get('run_name') or (source_pdf_path.stem if source_pdf_path.stem else "global-run")
            logging.info(f"Using run name as prefix: '{run_name}'")

            logging.info(f"\n{'='*60}\n--- Starting global workflow (Run Name: {run_name}) ---\n{'='*60}")
            run_workflow(config, run_name, source_pdf_path, args.force)
        
        logging.info("\n==========================================")
        logging.info("=== All processing complete successfully ===")
        logging.info("==========================================")

    except Exception as e:
        logging.error(f"\n[FATAL ERROR] An unexpected error occurred: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
