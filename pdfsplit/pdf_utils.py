
import logging
from pathlib import Path
from pypdf import PdfReader, PdfWriter

logging.basicConfig(
    level=logging.INFO,
    format="[%(levelname)s] %(message)s",
)

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
        
        pages = page_range_str.split('-')
        start_page = int(pages[0]) - 1
        end_page = int(pages[-1]) - 1

        if start_page < 0 or end_page >= len(reader.pages):
            raise IndexError(f"Page range '{page_range_str}' is out of bounds for PDF with {len(reader.pages)} pages.")

        for i in range(start_page, end_page + 1):
            writer.add_page(reader.pages[i])

        output_filename = f"{source_pdf_path.stem}-{page_range_str}.pdf"
        output_path = output_dir / output_filename
        
        with open(output_path, "wb") as f:
            writer.write(f)
        
        logging.info(f"Successfully created split PDF: {output_path}")
        return output_path
    except Exception as e:
        logging.error(f"Failed to split PDF '{source_pdf_path.name}': {e}")
        raise
