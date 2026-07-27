"""
Clause segmentation and classification for the NLP Processing Subsystem
(Chapter 4, Section 4.3.3).

Deliberately rule-based rather than a trained classifier — this is the
scoped-down approach agreed on in the implementation plan given the
two-week timeline. Chapter 4/5 should describe this honestly as a
keyword-matching heuristic, not a machine-learned classifier.

Approach:
    1. Split extracted_text into chunks (paragraphs, or numbered clauses
       if the contract uses "1.", "2." style numbering).
    2. Use spaCy only for sentence boundary cleanup within each chunk
       (not for classification itself).
    3. Classify each chunk by keyword matching against CLAUSE_KEYWORDS.
       First matching category wins; falls back to 'other'.
"""

import re
import spacy

_nlp = None  # lazy-loaded, see get_nlp()


def get_nlp():
    """Load spaCy's small English model once per process, not per request."""
    global _nlp
    if _nlp is None:
        _nlp = spacy.load('en_core_web_sm')
    return _nlp


# Keyword lists per clause type. Order matters: first match wins, so more
# specific categories are checked before general ones.
CLAUSE_KEYWORDS = {
    'termination': [
        'terminate', 'termination', 'notice period', 'notice of termination',
        'breach', 'expiry', 'expiration', 'end of this agreement',
    ],
    'payment': [
        'rent', 'deposit', 'salary', 'wage', 'payment', 'fee', 'invoice',
        'due monthly', 'due date', 'late payment',
    ],
    'confidentiality': [
        'confidential', 'non-disclosure', 'nda', 'proprietary information',
        'trade secret', 'do not share', 'not disclose',
    ],
    'renewal': [
        'renew', 'renewal', 'extend this agreement', 'extension of',
        'automatically renew',
    ],
}


def _split_into_chunks(text: str) -> list[str]:
    """
    Splits raw extracted text into clause-sized chunks.

    Tries numbered-clause splitting first (e.g. "1. ...", "2. ..."),
    which is common in Nigerian tenancy/employment contracts. Falls back
    to paragraph splitting (blank-line separated) if no numbering is
    detected.
    """
    numbered_pattern = re.compile(r'\n\s*\d{1,2}[\.\)]\s+')
    if len(numbered_pattern.findall(text)) >= 2:
        parts = numbered_pattern.split(text)
        return [p.strip() for p in parts if p.strip()]

    paragraphs = [p.strip() for p in re.split(r'\n\s*\n', text) if p.strip()]
    if len(paragraphs) >= 2:
        return paragraphs

    # Last resort: group sentences in threes so we don't return one giant
    # unclassifiable blob for contracts with no paragraph breaks at all.
    doc = get_nlp()(text)
    sentences = [s.text.strip() for s in doc.sents if s.text.strip()]
    chunk_size = 3
    return [
        ' '.join(sentences[i:i + chunk_size])
        for i in range(0, len(sentences), chunk_size)
    ]


def _classify_chunk(chunk: str) -> str:
    lower = chunk.lower()
    for clause_type, keywords in CLAUSE_KEYWORDS.items():
        if any(keyword in lower for keyword in keywords):
            return clause_type
    return 'other'


def identify_clauses(text: str) -> list[dict]:
    """
    Segments and classifies raw contract text.

    Returns:
        A list of dicts, one per identified clause, in document order:
        [{'position': 0, 'clause_type': 'payment', 'original_text': '...'}, ...]
    """
    chunks = _split_into_chunks(text)
    return [
        {
            'position': i,
            'clause_type': _classify_chunk(chunk),
            'original_text': chunk,
        }
        for i, chunk in enumerate(chunks)
    ]