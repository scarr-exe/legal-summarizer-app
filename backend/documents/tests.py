from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Document, Clause, Summary
from .date_extractor import _parse_span, extract_contract_dates
from .summarizer import summarize_text

User = get_user_model()


class DocumentDeleteTests(APITestCase):
    """Covers DELETE /api/documents/{id}/ — added so users can remove
    contracts they no longer want from the dashboard."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner', password='S0meStr0ngPass!')
        self.other = User.objects.create_user(username='other', password='S0meStr0ngPass!')

        self.document = Document.objects.create(
            user=self.owner,
            file_name='tenancy.pdf',
            file_type='pdf',
            extracted_text='1. RENT The tenant shall pay rent monthly.',
            status=Document.Status.COMPLETE,
        )
        clause = Clause.objects.create(
            document=self.document,
            clause_type='payment',
            original_text='The tenant shall pay rent monthly.',
            position=0,
        )
        Summary.objects.create(clause=clause, summary_text='The tenant must pay rent monthly.')

    def _auth(self, username):
        response = self.client.post('/api/auth/login/', {
            'username': username,
            'password': 'S0meStr0ngPass!',
        })
        return response.data['access']

    def test_owner_can_delete_document_and_cascades(self):
        access = self._auth('owner')
        response = self.client.delete(
            f'/api/documents/{self.document.id}/', HTTP_AUTHORIZATION=f'Bearer {access}'
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Document.objects.filter(id=self.document.id).exists())
        # Clause/Summary go with it via on_delete=CASCADE.
        self.assertEqual(Clause.objects.count(), 0)
        self.assertEqual(Summary.objects.count(), 0)

    def test_other_user_cannot_delete_someone_elses_document(self):
        access = self._auth('other')
        response = self.client.delete(
            f'/api/documents/{self.document.id}/', HTTP_AUTHORIZATION=f'Bearer {access}'
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Document.objects.filter(id=self.document.id).exists())

    def test_delete_requires_authentication(self):
        response = self.client.delete(f'/api/documents/{self.document.id}/')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertTrue(Document.objects.filter(id=self.document.id).exists())


class DateSpanParsingTests(TestCase):
    """Unit tests for the span-level guard in date_extractor.

    The rejection cases are the important ones: spaCy labels durations as
    DATE too, and dateutil's fuzzy parser turns them into real-looking
    dates by filling the missing parts in from today. These assertions
    are the regression guard against that fabrication.
    """

    def test_rejects_durations_and_vague_references(self):
        for span in (
            '30 days',
            'twelve (12) calendar months',
            'one (1) calendar month',
            'a period of',
            'months',
            'the anniversary of this Agreement',
        ):
            self.assertIsNone(_parse_span(span), f'should not parse: {span!r}')

    def test_parses_real_calendar_dates(self):
        self.assertEqual(_parse_span('1st August 2026'), date(2026, 8, 1))
        self.assertEqual(_parse_span('31st July 2027'), date(2027, 7, 31))
        self.assertEqual(_parse_span('2026-08-01'), date(2026, 8, 1))

    def test_month_year_span_anchors_to_the_first(self):
        """Regression: dateutil fills a missing day from *today*, so
        'August 2026' resolved to today's day-of-month and reprocessing the
        same contract on a different day produced a different date. The
        parser is now anchored to a fixed date, so the day is always 1."""
        self.assertEqual(_parse_span('August 2026'), date(2026, 8, 1))
        self.assertEqual(_parse_span('September 2027'), date(2027, 9, 1))

    def test_rejects_years_outside_a_sane_window(self):
        self.assertIsNone(_parse_span('12 January 1804'))
        self.assertIsNone(_parse_span('3 March 2999'))


class ContractDateExtractionTests(TestCase):
    """Tests the clause-level assignment rules."""

    def test_duration_clause_supplies_start_and_end(self):
        clauses = [{
            'clause_type': 'duration',
            'original_text': (
                'TERM OF TENANCY This tenancy shall commence on 1st August 2026 '
                'and shall continue for a period of twelve (12) calendar months, '
                'ending on 31st July 2027, unless terminated earlier.'
            ),
        }]
        dates = extract_contract_dates(clauses)
        self.assertEqual(dates['start_date'], date(2026, 8, 1))
        self.assertEqual(dates['end_date'], date(2027, 7, 31))
        self.assertIsNone(dates['renewal_date'])

    def test_notice_periods_do_not_become_dates(self):
        """A termination clause stating only a notice period must yield
        nothing — this is the case that previously fabricated a date."""
        clauses = [{
            'clause_type': 'termination',
            'original_text': (
                'TERMINATION Either party may terminate this Agreement by giving '
                'the other party not less than one (1) calendar month written '
                'notice, or 30 days notice in the case of material breach.'
            ),
        }]
        self.assertEqual(
            extract_contract_dates(clauses),
            {'start_date': None, 'end_date': None, 'renewal_date': None},
        )

    def test_renewal_clause_supplies_renewal_date(self):
        clauses = [{
            'clause_type': 'renewal',
            'original_text': (
                'RENEWAL This Agreement shall automatically renew on 1st August 2027 '
                'unless notice is given.'
            ),
        }]
        self.assertEqual(
            extract_contract_dates(clauses)['renewal_date'], date(2027, 8, 1)
        )

    def test_ignores_clause_types_that_are_not_date_bearing(self):
        clauses = [{
            'clause_type': 'payment',
            'original_text': 'Rent is due on 1st August 2026 and monthly thereafter.',
        }]
        self.assertEqual(
            extract_contract_dates(clauses),
            {'start_date': None, 'end_date': None, 'renewal_date': None},
        )

    def test_termination_date_used_only_when_duration_gives_no_end(self):
        clauses = [
            {
                'clause_type': 'duration',
                'original_text': 'This tenancy commences on 1st August 2026.',
            },
            {
                'clause_type': 'termination',
                'original_text': 'This Agreement ends on 31st July 2027.',
            },
        ]
        dates = extract_contract_dates(clauses)
        self.assertEqual(dates['start_date'], date(2026, 8, 1))
        self.assertEqual(dates['end_date'], date(2027, 7, 31))

    def test_backwards_range_is_discarded(self):
        """A start later than the end means the two dates came from
        unrelated sentences; better to drop the end than draw an
        impossible timeline."""
        clauses = [
            {
                'clause_type': 'duration',
                'original_text': 'This tenancy commences on 1st August 2026.',
            },
            {
                'clause_type': 'termination',
                'original_text': 'A prior agreement dated 5th May 2020 is superseded.',
            },
        ]
        dates = extract_contract_dates(clauses)
        self.assertEqual(dates['start_date'], date(2026, 8, 1))
        self.assertIsNone(dates['end_date'])

    def test_no_clauses_yields_all_none(self):
        self.assertEqual(
            extract_contract_dates([]),
            {'start_date': None, 'end_date': None, 'renewal_date': None},
        )


class ExtractiveSummaryTests(TestCase):
    """Covers the extractive selection layer added because the rule-based
    rewriter alone only reached 0.90x of the original length -- i.e. it
    simplified wording but never actually summarized."""

    def test_heading_is_stripped_before_selection(self):
        """Regression: spaCy parses an ALL-CAPS heading as its own
        sentence. Because it sits first it collected the opening-sentence
        boost and out-scored the real content, so the summary came out as
        just 'GOVERNING LAW'."""
        clause = (
            'GOVERNING LAW This Agreement shall be governed by the laws of the '
            'Federal Republic of Nigeria. The parties submit to the exclusive '
            'jurisdiction of the courts of Rivers State. Any dispute shall first '
            'be referred to good-faith negotiation.'
        )
        result = summarize_text(clause)
        self.assertNotEqual(result.strip(), 'GOVERNING LAW')
        self.assertNotIn('GOVERNING LAW', result)
        self.assertIn('Nigeria', result)

    def test_heading_with_trailing_period_also_stripped(self):
        clause = (
            'RENEWAL. This agreement shall automatically renew for a further '
            'period unless notice of non-renewal is given before expiration.'
        )
        result = summarize_text(clause)
        self.assertNotEqual(result.strip(), 'RENEWAL.')
        self.assertIn('renew', result.lower())

    def test_multi_sentence_clause_is_actually_shortened(self):
        clause = (
            'The Tenant agrees to pay rent of Four Hundred Thousand Naira '
            '(N400,000) for the tenancy period. Rent is due in full before '
            'occupation. A security deposit of Fifty Thousand Naira (N50,000) '
            'shall also be paid. The deposit is refundable at the end of the '
            'tenancy. The property must be returned in good condition.'
        )
        result = summarize_text(clause)
        self.assertLess(
            len(result.split()),
            len(clause.split()),
            'extractive pass should shorten a five-sentence clause',
        )

    def test_output_never_longer_than_input(self):
        clauses = [
            'The Employee shall report to the Head of Operations. The Employee '
            'shall perform such duties as are customarily associated with the role.',
            'Either party may terminate by giving thirty (30) days notice.',
            'CONFIDENTIALITY The Employee shall not disclose confidential '
            'information. This obligation survives termination of this Agreement.',
        ]
        for clause in clauses:
            self.assertLessEqual(
                len(summarize_text(clause).split()),
                len(clause.split()),
                f'output grew for: {clause[:50]}...',
            )

    def test_selected_sentences_keep_document_order(self):
        """Legal drafting cross-references earlier sentences ('such notice',
        'the foregoing'), so selection must not reorder by score."""
        clause = (
            'The Employer shall pay a monthly salary of N380,000. '
            'The Employee shall be entitled to twenty days of annual leave. '
            'Unused leave shall not be carried forward beyond January.'
        )
        result = summarize_text(clause)
        positions = [
            result.find(fragment)
            for fragment in ('380,000', 'twenty days', 'carried forward')
            if fragment in result
        ]
        self.assertEqual(
            positions, sorted(positions), 'sentences came back out of order'
        )

    def test_short_fragments_are_not_selected_alone(self):
        """A stray fragment can beat a real sentence on mean word
        significance; it must not become the whole summary."""
        clause = (
            'Provided that. The Employee shall be entitled to a signing bonus of '
            'One Hundred Thousand Naira (N100,000) payable within thirty days of '
            'resumption. The bonus is repayable if the Employee resigns within six months.'
        )
        result = summarize_text(clause)
        self.assertNotEqual(result.strip(), 'Provided that.')
        self.assertGreater(len(result.split()), 5)

    def test_single_sentence_clause_is_left_intact(self):
        clause = 'The Tenant shall pay rent of N450,000 before occupation.'
        result = summarize_text(clause)
        # Nothing to select between, so only the jargon swap applies.
        self.assertIn('must pay', result)
        self.assertIn('450,000', result)
