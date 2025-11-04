import logging
from pathlib import Path
from typing import Dict, List

from pypdf import PdfReader, PdfWriter

# This is defined here as it's a file utility, but it's configured in main.
OUTPUT_DIR = Path("output")


def _get_output_path(prefix: str, step_config: Dict) -> Path:
    """Constructs a robust output path from a step's configuration.

    Args:
        prefix: The prefix for the output file, typically the run name or page range.
        step_config: The configuration for the specific workflow step.

    Returns:
        The full path for the output file.
    """
    output_ext = step_config.get("output_extension", ".txt")
    suffix = step_config.get("output_suffix")

    filename_parts = [prefix]
    if suffix:
        filename_parts.append(suffix)

    output_filename = "-".join(filename_parts) + output_ext
    return OUTPUT_DIR / output_filename


def _resolve_dynamic_path(pattern: str, source_file: Path) -> Path:
    """
    Resolves a path pattern string with placeholders based on a source file.

    Supported placeholders:
    - {filename}: The full name of the file (e.g., 'chapter-1.txt')
    - {basename}: The name of the file without its extension (e.g., 'chapter-1')
    - {dirname}: The name of the immediate parent directory.
    - {ext}: The file extension, including the dot (e.g., '.txt')
    """
    if not pattern:
        raise ValueError("Output path pattern cannot be empty.")

    replacements = {
        "{filename}": source_file.name,
        "{basename}": source_file.stem,
        "{dirname}": source_file.parent.name,
        "{ext}": source_file.suffix,
    }

    resolved_path_str = pattern
    for key, value in replacements.items():
        resolved_path_str = resolved_path_str.replace(key, value)

    # Ensure the parent directory exists
    resolved_path = Path(resolved_path_str)
    resolved_path.parent.mkdir(parents=True, exist_ok=True)

    return resolved_path


def _gather_files(fileset_config: Dict, base_dir: Path, prefix: str) -> List[Path]:
    """Gathers files based on include/exclude glob patterns.

    Args:
        fileset_config: The configuration for the fileset.
        base_dir: The base directory to search for files.
        prefix: The prefix for the run, used for logging.

    Returns:
        A sorted list of paths to the gathered files.
    """
    include_patterns = fileset_config.get("include", [])
    exclude_patterns = fileset_config.get("exclude", [])

    logging.info(f"Searching for files to include in '{base_dir}'...")

    included_files = set()
    for pattern in include_patterns:
        # Using rglob for recursive search if the pattern contains '**'
        if "**" in pattern:
            files = base_dir.rglob(pattern.split("**/")[-1])
        else:
            files = base_dir.glob(pattern)
        for file in files:
            included_files.add(file.resolve())

    excluded_files = set()
    for pattern in exclude_patterns:
        if "**" in pattern:
            files = base_dir.rglob(pattern.split("**/")[-1])
        else:
            files = base_dir.glob(pattern)
        for file in files:
            excluded_files.add(file.resolve())

    final_files = sorted(list(included_files - excluded_files))
    logging.info(
        f"Fileset matched {len(final_files)} files: {[f.name for f in final_files][:5]}..."
    )
    return final_files


def is_stale(
    output_path: Path, dependency_paths: List[Path], force: bool = False
) -> bool:
    """Checks if an output file is stale and needs to be regenerated.

    Args:
        output_path: The path to the output file.
        dependency_paths: A list of paths to the dependencies of the output file.
        force: If True, the file is always considered stale.

    Returns:
        True if the file is stale, False otherwise.
    """
    if force:
        logging.info(f"--force active. '{output_path.name}' will be regenerated.")
        return True
    if not output_path.exists():
        return True
    output_mtime = output_path.stat().st_mtime
    for dep_path in dependency_paths:
        if not dep_path.exists() or dep_path.stat().st_mtime > output_mtime:
            logging.info(
                f"Dependency '{dep_path.name}' is newer or missing. Must regenerate '{output_path.name}'."
            )
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
    logging.info(
        f"Splitting PDF '{source_pdf_path.name}' for page range '{page_range_str}'."
    )
    output_dir.mkdir(exist_ok=True)
    try:
        reader = PdfReader(str(source_pdf_path))
        writer = PdfWriter()

        page_numbers = set()
        for part in page_range_str.split(","):
            if "-" in part:
                start, end = map(int, part.split("-"))
                for i in range(start, end + 1):
                    page_numbers.add(i)
            else:
                page_numbers.add(int(part))

        for page_num in sorted(list(page_numbers)):
            page_index = page_num - 1
            if 0 <= page_index < len(reader.pages):
                writer.add_page(reader.pages[page_index])
            else:
                raise IndexError(
                    f"Page number {page_num} is out of bounds for PDF with {len(reader.pages)} pages."
                )

        output_filename = f"{source_pdf_path.stem}-{page_range_str}.pdf"
        output_path = output_dir / output_filename

        with open(output_path, "wb") as f:
            writer.write(f)

        logging.info(f"Successfully created split PDF: {output_path}")
        return output_path
    except Exception as e:
        logging.error(f"Failed to split PDF '{source_pdf_path.name}': {e}")
        raise


def compress_pdf(pdf_path: Path):
    """Compresses a PDF in-place using the pikepdf library.

    Args:
        pdf_path: The path to the PDF file to compress.
    """
    try:
        import pikepdf
    except ImportError:
        logging.warning(
            "Cannot compress PDF: The 'pikepdf' library is not installed. "
            "Please run: pip install pikepdf"
        )
        return

    logging.info(f"Compressing {pdf_path.name} with pikepdf...")
    try:
        with pikepdf.open(pdf_path, allow_overwriting_input=True) as pdf:
            # Saving with these options helps to reduce the file size.
            pdf.save(
                pdf_path,
                recompress_flate=True,
                object_stream_mode=pikepdf.ObjectStreamMode.generate,
            )
        logging.info("Compression complete.")
    except Exception as e:
        logging.error(f"Failed to compress {pdf_path.name}: {e}")
