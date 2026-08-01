"""
Orchestrates the full NLP Processing Subsystem (Chapter 4, Section 4.3.3),
tying together clause_matcher.identify_clauses() and
summarizer.summarize_text() in the same sequence described by the
pseudocode in Chapter 4, Section 4.4.6.

This is intentionally the ONLY place that writes Clause/Summary rows,
so Phase 4 (API layer) and any future re-processing logic just calls
process_document() rather than duplicating this sequence.
"""

from django.db import transaction

from .models import Document, Clause, Summary
from .clause_matcher import identify_clauses
from .summarizer import summarize_text
from .date_extractor import extract_contract_dates


class ProcessingError(Exception):
    pass


def process_document(document: Document) -> Document:
    """
    Runs clause identification + summarization for a Document that
    already has extracted_text (i.e. has been through Phase 2).

    Safe to call again on an already-processed document — existing
    Clause/Summary rows for it are deleted and regenerated, rather than
    duplicated.
    """
    if not document.extracted_text or not document.extracted_text.strip():
        raise ProcessingError(
            'Document has no extracted_text — run extraction (Phase 2) first.'
        )

    clause_data = identify_clauses(document.extracted_text)
    if not clause_data:
        raise ProcessingError('No clauses could be identified in this document.')

    with transaction.atomic():
        # Clear out any previous run's results before regenerating.
        document.clauses.all().delete()

        for item in clause_data:
            clause = Clause.objects.create(
                document=document,
                position=item['position'],
                clause_type=item['clause_type'],
                original_text=item['original_text'],
            )
            summary_text = summarize_text(item['original_text'])
            Summary.objects.create(clause=clause, summary_text=summary_text)

        # Derived contract dates (Chapter 4, 4.4.5). Always reassigned, not
        # merged, so re-processing can't leave a stale date behind from an
        # earlier run whose clauses have since been deleted.
        dates = extract_contract_dates(clause_data)
        document.start_date = dates['start_date']
        document.end_date = dates['end_date']
        document.renewal_date = dates['renewal_date']

        document.status = Document.Status.COMPLETE
        document.save()

    return document