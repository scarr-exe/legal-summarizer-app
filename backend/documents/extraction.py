"""
Text extraction service for the Document Upload and Extraction Subsystem
(Chapter 4, Section 4.3.2).

CHANGE FROM PHASE 2: added _normalize_whitespace(). Some PDFs (depending
on how they were generated/encoded) cause PyPDF2 to insert a newline
after every single word instead of a normal space — e.g.
"RENT\n \nAND\n \nPAYMENT" instead of "RENT AND PAYMENT". Left unfixed,
this corrupts both clause classification (multi-word keyword phrases
never match) and summarization quality (the model sees broken
tokenization and produces garbled/hallucinated output). Normalizing
here, once, at the extraction boundary, means every downstream module
(clause_matcher, summarizer) can assume clean text.
"""

import re
import PyPDF2
import docx


class UnsupportedFileTypeError(Exception):
    pass


class ExtractionError(Exception):
    """Raised when a file is the right type but text can't be pulled from it
    (e.g. a scanned/image-only PDF with no embedded text layer)."""
    pass


def _normalize_whitespace(text: str) -> str:
    """
    Collapses runs of whitespace (including the word-per-line pattern
    some PDFs produce) down to single spaces, while still preserving
    paragraph breaks (blank lines) and numbered-clause line breaks,
    since clause_matcher's chunking relies on those.
    """
    # Preserve intentional paragraph breaks (two+ newlines) and numbered
    # clause breaks ("\n1. ", "\n2. ") by protecting them first.
    text = re.sub(r'\n\s*\n+', '\u0000PARA\u0000', text)
    text = re.sub(r'\n(\s*\d{1,2}[\.\)]\s+)', '\u0000NUM\u0000\\1', text)

    # Collapse every remaining run of whitespace (the word-per-line
    # corruption) into a single space.
    text = re.sub(r'\s+', ' ', text)

    # Restore the protected breaks.
    text = text.replace('\u0000PARA\u0000', '\n\n')
    text = text.replace('\u0000NUM\u0000', '\n')

    return text.strip()


def extract_text(file_obj, file_type: str) -> str:
    """
    Extract raw text from an uploaded contract file.

    Args:
        file_obj: an open file-like object (e.g. Django's UploadedFile)
        file_type: 'pdf' or 'docx' (matches Document.FileType choices)

    Returns:
        Extracted, whitespace-normalized plain text.

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

    return _normalize_whitespace(text)


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