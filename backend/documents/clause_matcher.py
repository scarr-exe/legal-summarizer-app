"""
Clause segmentation and classification for the NLP Processing Subsystem
(Chapter 4, Section 4.3.3).

CHANGES FROM THE FIRST VERSION, based on a real test run against a
sample tenancy agreement:

1. Added a 'duration' category. Previously, a clause about the tenancy
   TERM was misclassified as 'termination' just because it contained
   the word "terminated" once in passing ("...unless terminated
   earlier..."). Duration/term and termination are genuinely different
   clause types and need separate categories.

2. Classification is no longer first-match-wins by category order.
   That approach failed on the RENEWAL clause: it contains the word
   "expiration" (a termination keyword) and was checked before renewal
   keywords ever got a chance, so it was wrongly labeled 'termination'
   even though the section is literally titled "RENEWAL". Now:
     a. Check for an explicit ALL-CAPS heading at the start of the
        chunk first (numbered/headed contracts almost always name the
        clause type directly — this is the strongest possible signal
        and should short-circuit keyword scanning entirely when present).
     b. If no heading match, score every category by how many distinct
        keywords it matches, and pick the highest-scoring category
        rather than the first one that matches at all.

3. Keyword matching now uses word-boundary regex instead of plain
   substring checks. Substring matching meant short keywords matched
   inside unrelated words — e.g. the payment keyword 'rent' matched
   inside "cur-rent" and "diffe-rent", and the confidentiality keyword
   'nda' matched inside "age-nda". A clause about "the current terms of
   this agenda item" had nothing to do with payment or confidentiality
   but scored points for both. Word-boundary matching (`\\bkeyword\\b`)
   only matches whole words/phrases, which eliminates this entire class
   of false positive. Also dropped the generic duration keyword 'period
   of', which collided with the termination keyword 'notice period' —
   any termination clause mentioning "notice period of 30 days" was
   phantom-scoring a duration point too.

Still rule-based, not a trained classifier — that scope decision is
unchanged. This is a better rule, not a different approach.
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


# Keyword lists per clause type. No longer order-dependent for scanning
# (see _classify_chunk), but HEADING_NAMES below still lists them in a
# sensible priority order for the rare case a heading matches more than
# one category's name.
CLAUSE_KEYWORDS = {
    'duration': [
        'term of this agreement', 'term of tenancy', 'commence', 'commencement',
        'shall continue for', 'calendar months', 'duration of this agreement',
    ],
    'termination': [
        'terminate this agreement', 'termination of this agreement',
        'notice period', 'notice of termination', 'breach', 'material term',
        'terminate immediately',
    ],
    'payment': [
        'rent', 'rental', 'deposit', 'salary', 'wage', 'payment', 'fee', 'invoice',
        'due monthly', 'due date', 'late payment', 'non-refundable',
    ],
    'confidentiality': [
        'confidential', 'non-disclosure', 'nda', 'proprietary information',
        'trade secret', 'shall not be disclosed', 'not disclose',
    ],
    'renewal': [
        'renew', 'renewal', 'extend this agreement', 'extension of',
        'automatically renew', 'renewed for a further period',
    ],
}

# Used only to match an explicit section heading like "RENEWAL" or
# "TERM OF TENANCY" at the very start of a chunk — checked before any
# keyword scoring happens.
HEADING_NAMES = {
    'duration': ['term of tenancy', 'term of this agreement', 'duration'],
    'termination': ['termination'],
    'payment': ['rent and payment', 'payment', 'rent'],
    'confidentiality': ['confidentiality', 'non-disclosure'],
    'renewal': ['renewal'],
}


def _compile_word_boundary_patterns(keyword_map: dict) -> dict:
    """Compiles each keyword/phrase into a \\bphrase\\b regex so matching
    only fires on whole words, not substrings inside unrelated words."""
    return {
        clause_type: [re.compile(r'\b' + re.escape(kw) + r'\b') for kw in keywords]
        for clause_type, keywords in keyword_map.items()
    }


_CLAUSE_KEYWORD_PATTERNS = _compile_word_boundary_patterns(CLAUSE_KEYWORDS)
_HEADING_PATTERNS = _compile_word_boundary_patterns(HEADING_NAMES)


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


def _heading_match(chunk: str) -> str | None:
    """
    Checks the first ~8 words of the chunk (where a clause heading lives
    in a numbered contract) against HEADING_NAMES. Returns the matching
    clause_type, or None if no heading is recognized.
    """
    first_words = ' '.join(chunk.split()[:8]).lower()
    for clause_type, patterns in _HEADING_PATTERNS.items():
        if any(p.search(first_words) for p in patterns):
            return clause_type
    return None


def _classify_chunk(chunk: str) -> str:
    heading = _heading_match(chunk)
    if heading:
        return heading

    lower = chunk.lower()
    scores = {}
    for clause_type, patterns in _CLAUSE_KEYWORD_PATTERNS.items():
        matches = sum(1 for p in patterns if p.search(lower))
        if matches:
            scores[clause_type] = matches

    if not scores:
        return 'other'

    # Highest keyword-match count wins; ties fall back to the category
    # listed first in CLAUSE_KEYWORDS (dict order).
    return max(scores, key=scores.get)


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