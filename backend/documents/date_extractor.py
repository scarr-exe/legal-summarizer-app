"""
Contract date extraction for the NLP Processing Subsystem (Chapter 4,
Section 4.3.3), producing the "derived dates" that Section 4.4.5's
structured output describes.

Approach: run spaCy's named-entity recognition over the clauses that are
most likely to state contract dates (duration / termination / renewal),
take the entities labelled DATE, and resolve the ones that are genuine
calendar dates into real date objects.

WHY THE STRICT GUARD MATTERS
----------------------------
spaCy's DATE label covers durations as well as calendar dates, so the raw
entity list for a single tenancy clause looks like:

    '1st August 2026'  '31st July 2027'  'a period of'  'months'  '30 days'

Passing those straight to dateutil with fuzzy=True is actively dangerous,
because fuzzy parsing invents the missing components from *today's date*
rather than failing. Measured against the real spans above:

    '30 days'                     -> 2026-08-30   (fabricated month + year)
    'twelve (12) calendar months' -> 2026-08-12   (fabricated entirely)

Both are durations, not dates, and both would have been silently written
to the Document as though they were real contract dates — the kind of bug
that produces a confident, completely wrong timeline. _looks_like_calendar_date()
therefore requires an explicit 4-digit year AND a month indicator before a
span is handed to the parser at all. Anything else is discarded.

The deliberate consequence is that this under-detects rather than
over-detects: a contract phrased in a way this doesn't recognise yields
None, and the UI shows "no dates detected". That is the correct trade-off
here — a missing timeline is obvious to the user, whereas a fabricated one
is not.
"""

import re
from datetime import date

from dateutil import parser as date_parser

from .clause_matcher import get_nlp

# Clause types worth scanning. Payment/confidentiality clauses do contain
# dates sometimes, but they're due-dates and notice windows rather than the
# contract's own term, so including them adds noise without adding signal.
DATE_BEARING_CLAUSE_TYPES = ('duration', 'termination', 'renewal')

_YEAR_RE = re.compile(r'\b(19|20)\d{2}\b')
_MONTH_NAME_RE = re.compile(
    r'\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)',
    re.IGNORECASE,
)
# Numeric forms such as 01/08/2026 or 2026-08-01.
_NUMERIC_DATE_RE = re.compile(r'\b\d{1,4}[/-]\d{1,2}[/-]\d{1,4}\b')

# Sanity window. Anything outside it is a misparse (a stray figure read as a
# year, most often), not a real contract date.
_MIN_YEAR = 1990
_MAX_YEAR = 2100


def _looks_like_calendar_date(span: str) -> bool:
    """
    True only for spans that state an actual calendar date. Requires an
    explicit 4-digit year plus either a month name or a numeric date
    pattern, so durations ('30 days', 'twelve calendar months') and vague
    references ('the anniversary of this Agreement') are rejected before
    they ever reach the parser. See the module docstring for why this
    can't be left to dateutil's own error handling.
    """
    if not _YEAR_RE.search(span):
        return False
    return bool(_MONTH_NAME_RE.search(span) or _NUMERIC_DATE_RE.search(span))


def _parse_span(span: str) -> date | None:
    """Resolves a single DATE span to a real date, or None if it isn't one."""
    if not _looks_like_calendar_date(span):
        return None
    try:
        parsed = date_parser.parse(span, fuzzy=True)
    except (ValueError, OverflowError):
        return None

    if not (_MIN_YEAR <= parsed.year <= _MAX_YEAR):
        return None
    return parsed.date()


def _dates_in(text: str) -> list[date]:
    """All resolvable calendar dates in one clause, in document order."""
    doc = get_nlp()(text)
    found = []
    for ent in doc.ents:
        if ent.label_ != 'DATE':
            continue
        parsed = _parse_span(ent.text)
        if parsed is not None:
            found.append(parsed)
    return found


def extract_contract_dates(clause_data: list[dict]) -> dict:
    """
    Derives a contract's start / end / renewal dates from its classified
    clauses.

    Args:
        clause_data: the list identify_clauses() produces — dicts with
            'clause_type' and 'original_text' keys.

    Returns:
        {'start_date': date|None, 'end_date': date|None,
         'renewal_date': date|None}

    Assignment rules, kept deliberately simple and explainable:
      - A duration clause stating two or more dates is the common
        "commences on X ... ending on Y" shape, so the earliest becomes
        start_date and the latest end_date. A single date becomes
        start_date.
      - A termination clause's dates fill end_date only if a duration
        clause hasn't already supplied one — the term clause is the more
        authoritative source for when the contract actually ends.
      - Renewal clauses supply renewal_date (earliest, if several).
    """
    start_date = None
    end_date = None
    renewal_date = None
    termination_dates: list[date] = []

    for item in clause_data:
        clause_type = item.get('clause_type')
        if clause_type not in DATE_BEARING_CLAUSE_TYPES:
            continue

        found = _dates_in(item.get('original_text', ''))
        if not found:
            continue

        if clause_type == 'duration':
            if start_date is None:
                start_date = min(found)
            if len(found) > 1 and end_date is None:
                end_date = max(found)
        elif clause_type == 'renewal':
            if renewal_date is None:
                renewal_date = min(found)
        elif clause_type == 'termination':
            termination_dates.extend(found)

    # Only fall back to termination-clause dates if the term clause didn't
    # already tell us when the contract ends.
    if end_date is None and termination_dates:
        end_date = max(termination_dates)

    # A start after the end means the two came from unrelated sentences and
    # the pairing is wrong. Drop the weaker of the two rather than render an
    # impossible, backwards timeline.
    if start_date and end_date and start_date > end_date:
        end_date = None

    return {
        'start_date': start_date,
        'end_date': end_date,
        'renewal_date': renewal_date,
    }
