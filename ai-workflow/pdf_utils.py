
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
        page_range_str: A string representing the page range (e.g., '1-5', '10', '35,36-38').
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
