import logging
from pathlib import Path
from typing import Dict, List

from pypdf import PdfReader, PdfWriter

# This is defined here as it's a file utility, but it's configured in main.
OUTPUT_DIR = Path("output")

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
    """Checks if an output file is stale and needs to be regenerated."""
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

def split_pdf(source_pdf_path: Path, page_range_str: str, output_dir: Path) -> Path:
    """
    Extracts a range of pages from a source PDF and saves them to a new file.

    Args:
        source_pdf_path: Path to the source PDF file.
        page_range_str: A string representing the page range (e.g., '1-5', '10').
        output_dir: The directory to save the new PDF file.

    Returns:
        The path to the newly created PDF file.
    """
    logging.info(f"Splitting PDF '{source_pdf_path.name}' for page range '{page_range_str}'.")
    output_dir.mkdir(exist_ok=True)
    try:
        reader = PdfReader(str(source_pdf_path))
        writer = PdfWriter()
        
        page_numbers = set()
        for part in page_range_str.split(','):
            if '-' in part:
                start, end = map(int, part.split('-'))
                for i in range(start, end + 1):
                    page_numbers.add(i)
            else:
                page_numbers.add(int(part))

        for page_num in sorted(list(page_numbers)):
            page_index = page_num - 1
            if 0 <= page_index < len(reader.pages):
                writer.add_page(reader.pages[page_index])
            else:
                raise IndexError(f"Page number {page_num} is out of bounds for PDF with {len(reader.pages)} pages.")

        output_filename = f"{source_pdf_path.stem}-{page_range_str}.pdf"
        output_path = output_dir / output_filename
        
        with open(output_path, "wb") as f:
            writer.write(f)
        
        logging.info(f"Successfully created split PDF: {output_path}")
        return output_path
    except Exception as e:
        logging.error(f"Failed to split PDF '{source_pdf_path.name}': {e}")
        raise
