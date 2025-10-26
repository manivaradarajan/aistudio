
import argparse
import os
import logging
from pathlib import Path
import sys
import time
import threading
import itertools
from typing import Dict, Any, List, Union

import google.generativeai as genai
from google.api_core import exceptions

from aksharamukha import transliterate
from dotenv import load_dotenv
from pypdf import PdfReader, PdfWriter
from pdf_utils import split_pdf
import yaml

# --- Configuration ---
logging.basicConfig(
    level=logging.INFO,
    format="[%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
OUTPUT_DIR = Path("output")


# --- Spinner Class ---
class Spinner:
    def __init__(self, message="Processing..."):
        self.spinner_cycle = itertools.cycle(["-", "\\", "|", "/"])
        self.delay = 0.1
        self.running = False
        self.spinner_thread = None
        self.message = message

    def _spinner_task(self):
        while self.running:
            sys.stdout.write(f"\r{next(self.spinner_cycle)} {self.message}")
            sys.stdout.flush()
            time.sleep(self.delay)
        sys.stdout.write("\r" + " " * (len(self.message) + 3) + "\r") # Clear spinner
        sys.stdout.flush()

    def start(self):
        self.running = True
        self.spinner_thread = threading.Thread(target=self._spinner_task)
        self.spinner_thread.daemon = True
        self.spinner_thread.start()

    def stop(self):
        self.running = False
        if self.spinner_thread and self.spinner_thread.is_alive():
            self.spinner_thread.join()


# --- Helper Functions ---

def _get_output_path(prefix: str, step_config: Dict) -> Path:
    """Helper function to construct a robust output path from a step's configuration."""
    output_ext = step_config.get('output_extension', '.txt')
    suffix = step_config.get('output_suffix')
    
    filename_parts = [prefix]
    if suffix:
        filename_parts.append(suffix)
    
    output_filename = "-".join(filename_parts) + output_ext
    return OUTPUT_DIR / output_filename

def _gather_files(fileset_config: Dict, base_dir: Path, prefix: str) -> List[Path]:
    """Gathers files based on include/exclude glob patterns."""
    include_patterns = fileset_config.get('include', [])
    exclude_patterns = fileset_config.get('exclude', [])
    is_global_search = fileset_config.get('global_search', False)
    
    glob_prefix = "" if is_global_search else f"{prefix}"
    if is_global_search:
        logging.info(f"Performing global search in '{base_dir}'...")
    else:
        logging.info(f"Searching with prefix '{glob_prefix}'...")

    included_files = set()
    for pattern in include_patterns:
        for file in base_dir.glob(f"{glob_prefix}{pattern}"):
            included_files.add(file)
            
    excluded_files = set()
    for pattern in exclude_patterns:
        for file in base_dir.glob(f"{glob_prefix}{pattern}"):
            excluded_files.add(file)
            
    final_files = sorted(list(included_files - excluded_files))
    logging.info(f"Fileset matched {len(final_files)} files: {[f.name for f in final_files][:5]}...")
    return final_files

def is_stale(output_path: Path, dependency_paths: List[Path], force: bool = False) -> bool:
    if force:
        logging.info(f"--force active. '{output_path.name}' will be regenerated.")
        return True
    if not output_path.exists():
        return True
    output_mtime = output_path.stat().st_mtime
    for dep_path in dependency_paths:
        if not dep_path.exists() or dep_path.stat().st_mtime > output_mtime:
            logging.info(f"Dependency '{dep_path.name}' is newer or missing. Must regenerate '{output_path.name}'.")
            return True
    return False

def get_gemini_api_key() -> str:
    load_dotenv()
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not found in environment or .env file.")
    return api_key

# --- Step Handler Functions ---

def handle_extract_text_step(step: Dict, config: Dict, prefix: str, input_pdf: Path, context: Dict, force: bool) -> Path:
    logging.info("\n[Workflow Step: extract_text_from_pdf]")
    output_path = _get_output_path(prefix, step)
    prompt_path = Path(step['prompt'])
    
    if is_stale(output_path, [input_pdf, prompt_path], force):
        logging.info(f"Uploading '{input_pdf.name}' and generating text with '{prompt_path.name}'.")
        model = genai.GenerativeModel(config['model'])
        file_handle = genai.upload_file(path=str(input_pdf))
        context['initial_file_handle'] = file_handle
        logging.info(f"File uploaded successfully. Context handle stored.")
        
        while True:
            try:
                response = model.generate_content([prompt_path.read_text(encoding='utf-8'), file_handle])
                output_path.write_text(response.text, encoding='utf-8')
                logging.info(f"--> Saved output to: {output_path}")
                break
            except exceptions.ResourceExhausted as e:
                delay = e.retry_delay if hasattr(e, 'retry_delay') else 30
                logging.warning(f"Gemini API quota exceeded. Retrying in {delay} seconds... Error: {e}")
                time.sleep(delay)
            except Exception as e:
                logging.error(f"An unexpected error occurred during Gemini API call: {e}")
                raise
    else:
        logging.info(f"Skipping step. Using cached file: {output_path}")
    return output_path

def handle_convert_script_step(step: Dict, prefix: str, input_path: Path, force: bool) -> Path:
    logging.info("\n[Workflow Step: convert_script]")
    output_path = _get_output_path(prefix, step)

    if is_stale(output_path, [input_path], force):
        logging.info(f"Converting '{input_path.name}' from {step['from']} to {step['to']}.")
        input_text = input_path.read_text(encoding='utf-8')
        converted_text = transliterate.process(step['from'], step['to'], input_text)
        output_path.write_text(converted_text, encoding='utf-8')
        logging.info(f"--> Saved output to: {output_path}")
    else:
        logging.info(f"Skipping step. Using cached file: {output_path}")
    return output_path

def handle_chat_step(step: Dict, config: Dict, prefix: str, input_path: Path, context: Dict, force: bool) -> Path:
    logging.info("\n[Workflow Step: chat]")
    model = genai.GenerativeModel(config['model'])
    chat_session = model.start_chat(history=[])
    logging.info("Started new Gemini chat session.")
    
    current_chat_input_path = input_path
    
    for i, turn in enumerate(step['turns']):
        logging.info(f"-- Chat Turn {i+1}/{len(step['turns'])} --")
        turn_prompt_path = Path(turn['prompt'])
        output_path = _get_output_path(prefix, turn)
        
        dependencies = [current_chat_input_path, turn_prompt_path]
        fileset_content = ""
        
        if 'fileset' in turn:
            turn_files = _gather_files(turn['fileset'], OUTPUT_DIR, prefix)
            dependencies.extend(turn_files)
            if turn_files:
                logging.info(f"Concatenating content from {len(turn_files)} files for this turn...")
                content_parts = []
                for file_path in turn_files:
                    logging.info(f"  -> Reading: {file_path.name}")
                    content_parts.append(f"--- CONTENT FROM {file_path.name} ---\n\n{file_path.read_text(encoding='utf-8')}")
                fileset_content = "\n\n".join(content_parts)

        if is_stale(output_path, dependencies, force):
            if current_chat_input_path.suffix == '.pdf':
                input_text = ""
                logging.info("Chat step started with a PDF as input; using empty text as base.")
            else:
                input_text = current_chat_input_path.read_text(encoding='utf-8')

            # Order: Main prompt, then base text, then concatenated fileset text.
            message_parts = [
                turn_prompt_path.read_text(encoding='utf-8'),
                input_text,
                fileset_content
            ]

            # Add initial PDF handle on the first turn, if it exists
            if i == 0 and context.get('initial_file_handle'):
                logging.info("Attaching initial PDF context to the chat.")
                message_parts.append(context['initial_file_handle'])

            logging.info(f"Sending prompt '{turn_prompt_path.name}' to chat session.")
            while True:
                try:
                    response = chat_session.send_message(message_parts)
                    output_path.write_text(response.text, encoding='utf-8')
                    logging.info(f"--> Saved turn output to: {output_path}")
                    break
                except exceptions.ResourceExhausted as e:
                    delay = e.retry_delay if hasattr(e, 'retry_delay') else 30
                    logging.warning(f"Gemini API quota exceeded. Retrying in {delay} seconds... Error: {e}")
                    time.sleep(delay)
                except Exception as e:
                    logging.error(f"An unexpected error occurred during Gemini API call: {e}")
                    raise
        else:
            logging.info(f"Skipping turn. Using cached file: {output_path}")
        
        current_chat_input_path = output_path

    return current_chat_input_path

# --- Workflow Engine ---

def run_workflow(config: Dict, prefix: str, source_path: Path, force_regeneration: bool):
    workflow_steps = config['workflow']
    workflow_context = {}
    current_input_path = source_path

    for step in workflow_steps:
        step_type = step['type']
        
        if step_type == 'extract_text_from_pdf':
            current_input_path = handle_extract_text_step(step, config, prefix, current_input_path, workflow_context, force_regeneration)
        elif step_type == 'convert_script':
            current_input_path = handle_convert_script_step(step, prefix, current_input_path, force_regeneration)
        elif step_type == 'chat':
            current_input_path = handle_chat_step(step, config, prefix, current_input_path, workflow_context, force_regeneration)
        else:
            raise ValueError(f"Unknown workflow step type: {step_type}")

# --- Main Function ---

def main(yaml_path: str, force_regeneration: bool):
    logging.info("==============================================")
    logging.info("=== Starting Dynamic PDF Processing Workflow ===")
    logging.info("==============================================")
    try:
        if force_regeneration:
            logging.warning("FORCE flag is active. All files will be regenerated.")
        
        genai.configure(api_key=get_gemini_api_key())
        logging.info("Gemini API configured.")
        
        OUTPUT_DIR.mkdir(exist_ok=True)
        logging.info(f"Output directory is '{OUTPUT_DIR}'.")

        with open(yaml_path, 'r') as f:
            config = yaml.safe_load(f)
        logging.info(f"Configuration loaded from '{yaml_path}'.")

        # Decide execution mode based on presence of page_ranges
        if "page_ranges" in config and config["page_ranges"]:
            logging.info("Executing in 'per-page-range' mode.")
            
            if "pdf_file" not in config:
                raise ValueError("'pdf_file' key is required in the YAML when 'page_ranges' is defined.")
            source_pdf_path = Path(config["pdf_file"])
            if not source_pdf_path.exists():
                raise FileNotFoundError(f"Source PDF not found: {source_pdf_path}")

            for item in config["page_ranges"]:
                if isinstance(item, dict):
                    page_range_str, custom_suffix = str(item['page_range']), item.get('suffix')
                else:
                    page_range_str, custom_suffix = str(item), None
                
                prefix = f"{source_pdf_path.stem}-{page_range_str}-{custom_suffix}" if custom_suffix else f"{source_pdf_path.stem}-{page_range_str}"
                logging.info(f"\n{'='*60}\n--- Starting processing for page range: {page_range_str} (Prefix: {prefix}) ---\n{'='*60}")

                initial_input_path = OUTPUT_DIR / f"{prefix}.pdf"
                if is_stale(initial_input_path, [source_pdf_path], force=force_regeneration):
                    temp_split_path = split_pdf(source_pdf_path, page_range_str, OUTPUT_DIR)
                    if temp_split_path != initial_input_path:
                        temp_split_path.rename(initial_input_path)
                else:
                    logging.info(f"Using cached split PDF: {initial_input_path}")
                
                run_workflow(config, prefix, initial_input_path, force_regeneration)
        else:
            logging.info("No 'page_ranges' found. Executing in 'global' mode.")
            
            source_pdf_path = Path(config["pdf_file"]) if "pdf_file" in config else Path()
            if "pdf_file" in config and not source_pdf_path.exists():
                 raise FileNotFoundError(f"Source PDF '{source_pdf_path}' not found.")

            prefix = config.get('run_name')
            if not prefix:
                prefix = source_pdf_path.stem if source_pdf_path.stem else "global-run"
                logging.info(f"'run_name' not found in YAML, using default prefix: '{prefix}'")

            logging.info(f"\n{'='*60}\n--- Starting global workflow (Run Name: {prefix}) ---\n{'='*60}")
            run_workflow(config, prefix, source_pdf_path, force_regeneration)
        
        logging.info("\n==========================================")
        logging.info("=== All processing complete successfully ===")
        logging.info("==========================================")

    except Exception as e:
        logging.error(f"\n[FATAL ERROR] An unexpected error occurred: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="A dynamic, YAML-driven PDF processing script.")
    parser.add_argument("yaml_file", help="Path to the YAML configuration file.")
    parser.add_argument("--force", action="store_true", help="Force regeneration of all files.")
    args = parser.parse_args()
    main(args.yaml_file, args.force)
