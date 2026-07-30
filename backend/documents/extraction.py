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

FOLLOW-UP FIX, from a real test upload: the first version of
_normalize_whitespace() assumed "two or more newlines" always meant a
genuine paragraph break, worth preserving as \n\n. That assumption broke
on a real PDF where PyPDF2 put a BLANK LINE between every single word
("TENANCY\n\nAGREEMENT\n\nThis\n\nTenancy...") — every one of those blank
lines got preserved as if it were a real paragraph break, so the
corruption passed straight through untouched. _looks_like_word_per_line()
below detects this case (many blank-line-separated segments that are
each only one or two words) and switches to a more aggressive collapse
that doesn't trust blank lines at all, while still preserving numbered
clause markers so clause_matcher can still segment the document.
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


def _looks_like_word_per_line(text: str) -> bool:
    """
    Detects PDFs where PyPDF2 has put a blank line between every single
    word, rather than genuine paragraph breaks. A real paragraph is
    normally at least a full sentence (10+ words); if most blank-line
    separated segments are only one or two words long, and there are
    enough of them to rule out coincidence (a short heading, say), the
    blank lines aren't paragraph breaks at all.
    """
    segments = [s for s in re.split(r'\n\s*\n+', text) if s.strip()]
    if len(segments) <= 20:
        return False
    avg_words = sum(len(s.split()) for s in segments) / len(segments)
    return avg_words < 4


def _normalize_whitespace(text: str) -> str:
    """
    Collapses runs of whitespace (including the word-per-line pattern
    some PDFs produce) down to single spaces, while still preserving
    numbered-clause line breaks, since clause_matcher's chunking relies
    on those. Genuine paragraph breaks (blank lines) are preserved too --
    unless the text looks like the word-per-line corruption case (see
    _looks_like_word_per_line), where blank lines carry no real
    structure and get collapsed like any other whitespace instead.
    """
    word_per_line = _looks_like_word_per_line(text)

    # Numbered clause breaks ("\n1. ", "\n2. ") are always worth keeping,
    # corrupted or not -- protect them first either way.
    text = re.sub(r'\n(\s*\d{1,2}[\.\)]\s+)', '\u0000NUM\u0000\\1', text)

    if not word_per_line:
        # Preserve intentional paragraph breaks (two+ newlines).
        text = re.sub(r'\n\s*\n+', '\u0000PARA\u0000', text)

    # Collapse every remaining run of whitespace (the word-per-line
    # corruption, or just normal line wrapping) into a single space.
    text = re.sub(r'\s+', ' ', text)

    # Restore the protected breaks.
    if not word_per_line:
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