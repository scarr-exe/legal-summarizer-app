"""
Text extraction service for the Document Upload and Extraction Subsystem
(Chapter 4, Section 4.3.2).

Kept as a standalone module (rather than inline in views.py) so Phase 3
can import extract_text() directly without touching the view layer —
matches the module boundary implied by the System Architecture Diagram
in Chapter 3, Figure 3.3.
"""

import PyPDF2
import docx


class UnsupportedFileTypeError(Exception):
    pass


class ExtractionError(Exception):
    """Raised when a file is the right type but text can't be pulled from it
    (e.g. a scanned/image-only PDF with no embedded text layer)."""
    pass


def extract_text(file_obj, file_type: str) -> str:
    """
    Extract raw text from an uploaded contract file.

    Args:
        file_obj: an open file-like object (e.g. Django's UploadedFile)
        file_type: 'pdf' or 'docx' (matches Document.FileType choices)

    Returns:
        Extracted plain text as a single string.

    Raises:
        UnsupportedFileTypeError: if file_type isn't 'pdf' or 'docx'
        ExtractionError: if the file is valid but no text could be extracted
    """
    if file_type == 'pdf':
        text = _extract_from_pdf(file_obj)
    elif file_type == 'docx':
        text = _extract_from_docx(file_obj)
    else:
        raise UnsupportedFileTypeError(f'Unsupported file type: {file_type}')

    if not text or not text.strip():
        raise ExtractionError(
            'No extractable text found. The file may be a scanned image '
            'with no text layer, which this system does not OCR.'
        )
    return text.strip()


def _extract_from_pdf(file_obj) -> str:
    reader = PyPDF2.PdfReader(file_obj)
    pages_text = []
    for page in reader.pages:
        page_text = page.extract_text() or ''
        pages_text.append(page_text)
    return '\n'.join(pages_text)


def _extract_from_docx(file_obj) -> str:
    document = docx.Document(file_obj)
    paragraphs_text = [p.text for p in document.paragraphs]
    return '\n'.join(paragraphs_text)


def validate_file(file_name: str, file_size: int, max_size_mb: int) -> str:
    """
    Validates an uploaded file's extension and size before extraction runs.

    Returns:
        The detected file_type ('pdf' or 'docx') on success.

    Raises:
        UnsupportedFileTypeError: if extension isn't .pdf or .docx
        ValueError: if file exceeds max_size_mb
    """
    lower_name = file_name.lower()
    if lower_name.endswith('.pdf'):
        file_type = 'pdf'
    elif lower_name.endswith('.docx'):
        file_type = 'docx'
    else:
        raise UnsupportedFileTypeError(
            f'"{file_name}" is not a PDF or DOCX file.'
        )

    max_bytes = max_size_mb * 1024 * 1024
    if file_size > max_bytes:
        raise ValueError(
            f'File exceeds the {max_size_mb}MB limit.'
        )

    return file_type