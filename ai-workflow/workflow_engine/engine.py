import logging
from pathlib import Path
from typing import Dict, List, Union

from pypdf import PdfReader
from tqdm import tqdm

from . import handlers
from .file_utils import is_stale, split_pdf, OUTPUT_DIR

def handle_run_if_step(step: Dict, config: Dict, prefix: str, current_input_path: Path, workflow_context: Dict, force_regeneration: bool) -> Path:
    """
    Handles the 'run_if' workflow step for conditional execution.
    """
    logging.info("\n[Workflow Step: run_if]")
    condition = step['condition']
    
    condition_met = False
    if 'file_exists' in condition:
        file_to_check = Path(condition['file_exists'])
        if file_to_check.exists():
            condition_met = True
            logging.info(f"Condition 'file_exists: {file_to_check}' is TRUE.")
        else:
            logging.info(f"Condition 'file_exists: {file_to_check}' is FALSE.")

    if condition_met:
        logging.info("Condition met. Running nested steps...")
        nested_steps = step['steps']
        return _run_steps(nested_steps, config, prefix, current_input_path, workflow_context, force_regeneration)
    else:
        logging.info("Condition not met. Skipping nested steps.")
        return current_input_path

def _run_steps(steps: List[Dict], config: Dict, prefix: str, initial_input_path: Path, workflow_context: Dict, force_regeneration: bool) -> Path:
    """Recursively runs a list of workflow steps."""
    current_input_path = initial_input_path
    defaults = config.get('defaults', {})

    for step in steps:
        step_type = step['type']
        
        default_config = defaults.get(step_type, {})
        merged_step = {**default_config, **step}

        if step_type == 'extract_text_from_pdf':
            current_input_path = handlers.handle_extract_text_step(merged_step, config, prefix, current_input_path, workflow_context, force_regeneration)
        elif step_type == 'convert_script':
            current_input_path = handlers.handle_convert_script_step(merged_step, prefix, current_input_path, force_regeneration)
        elif step_type == 'chat':
            current_input_path = handlers.handle_chat_step(merged_step, config, prefix, current_input_path, workflow_context, force_regeneration)
        elif step_type == 'gather_files':
            handlers.handle_gather_files_step(merged_step, workflow_context, prefix)
        elif step_type == 'run_if':
            current_input_path = handle_run_if_step(merged_step, config, prefix, current_input_path, workflow_context, force_regeneration)
        else:
            raise ValueError(f"Unknown workflow step type: {step_type}")
    return current_input_path

def run_workflow(config: Dict, prefix: str, source_path: Path, force_regeneration: bool):
    """
    Initializes and runs the dynamic workflow based on the provided configuration.
    """
    workflow_steps = config['workflow']
    workflow_context = {}
    _run_steps(workflow_steps, config, prefix, source_path, workflow_context, force_regeneration)

def _generate_page_ranges(page_ranges_config: Union[List, Dict], source_pdf_path: Path) -> List[str]:
    """
    Generates a list of page range strings based on the configuration.
    """
    if isinstance(page_ranges_config, list):
        return page_ranges_config

    if isinstance(page_ranges_config, dict) and 'pageset_size' in page_ranges_config:
        pageset_size = int(page_ranges_config['pageset_size'])
        logging.info(f"Detected 'pageset_size' of {pageset_size}. Generating page ranges dynamically.")
        
        try:
            reader = PdfReader(source_pdf_path)
            total_pages = len(reader.pages)
        except Exception as e:
            raise ValueError(f"Failed to read source PDF '{source_pdf_path}' to determine total pages for pageset generation. Error: {e}")

        start_page_overall = int(page_ranges_config.get('start', 1))
        end_page_overall = int(page_ranges_config.get('end', total_pages))

        logging.info(f"Processing from page {start_page_overall} to {end_page_overall}.")

        page_ranges_list = []
        current_page = start_page_overall
        while current_page <= end_page_overall:
            start_page_chunk = current_page
            end_page_chunk = min(current_page + pageset_size - 1, end_page_overall)
            page_ranges_list.append(f"{start_page_chunk}-{end_page_chunk}")
            current_page += pageset_size

        logging.info(f"Generated {len(page_ranges_list)} page ranges: {page_ranges_list[:5]}...")
        return page_ranges_list
    
    raise TypeError(f"Unsupported type for 'page_ranges': {type(page_ranges_config)}. Must be a list of ranges or a dict with 'pageset_size'.")

def _process_page_ranges(config: Dict, source_pdf_path: Path, force_regeneration: bool):
    """
    Processes the PDF in chunks based on the page ranges configuration.
    """
    logging.info("Executing in 'per-page-range' mode.")
    
    if not source_pdf_path.exists():
        raise FileNotFoundError(f"Source PDF not found: {source_pdf_path}")

    page_ranges = _generate_page_ranges(config["page_ranges"], source_pdf_path)

    for item in tqdm(page_ranges, desc="Processing page ranges"):
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
