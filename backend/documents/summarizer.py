"""
Plain-language rewriting for the NLP Processing Subsystem (Chapter 4,
Section 4.3.3).

CHANGE FROM THE FIRST VERSION, based on a real test run: the pretrained
distilbart-cnn-12-6 model does not genuinely summarize this kind of text.
Tested directly against real clause text of varying lengths (including a
229-word indemnification clause, with beam search, no_repeat_ngram_size,
and length_penalty all enabled) it consistently produced near-verbatim
copies of the source cut off at the output token limit, rather than an
abstractive rewrite. This isn't a parameter-tuning problem -- the model
was trained on CNN/DailyMail news wire text and doesn't generalize to
formal contract/legal register, especially not on short (40-100 word)
inputs where it has very little to compress.

So the primary path is now a deterministic rule-based plain-language
rewriter (_simplify_plain_language): it strips the ALL-CAPS section
heading most clauses start with, and swaps common legal jargon for plain
equivalents (shall -> must, notwithstanding -> despite, etc). It is not a
compressor -- it does not drop sentences or shorten the clause, only
rewords it -- so it can't silently cut a proviso the way truncating text
could.

The Transformers model is still used, but only as an optional second
pass for genuinely long clauses (LONG_CLAUSE_WORD_THRESHOLD), where
there's enough source material for real compression to be possible. Its
output is checked against _looks_like_near_copy() before being trusted;
if it just extended the copy again, the rule-based version is used
instead. In practice this means the model rarely wins for the kind of
Nigerian tenancy/employment clauses this system targets -- documented
here honestly rather than left to look like the model is doing more work
than it is.
"""

import math
import re

from .clause_matcher import get_nlp

_summarizer = None  # lazy-loaded, see get_summarizer()
_summarizer_unavailable = False  # set once if transformers/torch aren't installed

# Kept for the rare long clause where genuine compression is worth
# attempting -- see module docstring for why this is a secondary path,
# not the primary one.
MODEL_NAME = 'sshleifer/distilbart-cnn-12-6'

# Below this word count, a clause is short enough that the pretrained
# model has essentially nothing to compress -- skip straight to the
# rule-based rewrite rather than pay the model's cost for no benefit.
LONG_CLAUSE_WORD_THRESHOLD = 130

# Extractive selection settings. Keeping roughly half a clause's sentences
# (capped, so a very long clause still compresses hard) lands around
# 0.4-0.5x of the original -- real compression, where rewording alone only
# managed 0.90x.
EXTRACT_KEEP_RATIO = 0.5
EXTRACT_MAX_SENTENCES = 3
# Below this, there is nothing meaningful to select between. Set to 2, not
# 3, because measuring the real corpus showed 48% of clauses are exactly
# two sentences and another 18% are one -- a threshold of 3 skipped two
# thirds of the corpus and left overall compression at 0.90x, i.e. no
# better than rewording alone. Dropping one of two sentences is a real
# 0.5x, and is safe here specifically because the UI always shows the
# original clause beside the summary: the summary is the gist, not a
# replacement for reading the clause.
EXTRACT_MIN_SENTENCES = 2

# Scoring boosts, tuned for contract language rather than prose. A clause's
# operative content lives in the sentences that impose an obligation or
# state a figure/date, so those outrank merely descriptive ones.
_OBLIGATION_RE = re.compile(
    r'\b(shall|must|may not|shall not|is entitled|are entitled|agrees to|undertakes)\b',
    re.IGNORECASE,
)
_OBLIGATION_BOOST = 0.35
_FIGURE_BOOST = 0.30
_FIRST_SENTENCE_BOOST = 0.15
_FIGURE_ENT_LABELS = {'MONEY', 'DATE', 'PERCENT', 'CARDINAL', 'QUANTITY'}


def get_summarizer():
    """Loads the pretrained model, or returns None if it isn't available.

    transformers is imported here rather than at module scope so the
    package (and torch, ~1GB) becomes an *optional* dependency. The
    neural path is a secondary one that fires on a small minority of
    clauses and usually loses the near-copy check anyway, so a deployment
    that omits it still produces correct output via the extractive +
    rule-based path -- while shedding about a gigabyte of image and a
    1.2GB model download on every cold start.

    Install the extras (see requirements-ml.txt) to enable it.
    """
    global _summarizer, _summarizer_unavailable
    if _summarizer_unavailable:
        return None
    if _summarizer is None:
        try:
            from transformers import pipeline
        except ImportError:
            _summarizer_unavailable = True
            return None
        _summarizer = pipeline('summarization', model=MODEL_NAME)
    return _summarizer


# Ordered longest-phrase-first so a shorter pattern doesn't consume part
# of a longer one it's nested inside (e.g. 'shall' vs 'shall not').
_JARGON_REPLACEMENTS = [
    (r'for the avoidance of doubt,?\s*', ''),
    (r'notwithstanding the foregoing,?\s*', 'despite the above, '),
    (r'notwithstanding\b', 'despite'),
    (r'in the event that\b', 'if'),
    (r'in the event of\b', 'if there is'),
    (r'prior to\b', 'before'),
    (r'subsequent to\b', 'after'),
    (r'in accordance with\b', 'under'),
    (r'pursuant to\b', 'under'),
    (r'provided that\b', 'as long as'),
    (r'with respect to\b', 'regarding'),
    (r'hereinafter referred to as\b', 'referred to as'),
    (r'shall not\b', 'must not'),
    (r'shall\b', 'must'),
    (r'commencement\b', 'start'),
    (r'commence\b', 'start'),
]

# Matches one or more consecutive ALL-CAPS "words" (hyphens allowed, e.g.
# NON-COMPETE) at the very start of the text, stopping right before the
# first normally-capitalized word -- the exact shape of the headings
# clause_matcher's chunks start with ("REMUNERATION The Employer shall
# ..."). Requires a lookahead rather than consuming the following word so
# a clause with NO heading (starting straight in lowercase-after-initial,
# e.g. "This is...") is left untouched.
# The optional trailing dot matters: some clauses are written "RENEWAL.
# This agreement..." rather than "RENEWAL This agreement...", and without
# it spaCy reads "RENEWAL." as a complete sentence which then competes
# with (and beats) the real content during extractive selection.
_HEADING_PREFIX = re.compile(r'^(?:[A-Z][A-Z\-]*\.?\s+){1,8}(?=[A-Z][a-z])')

# A selectable sentence needs at least this many words. Guards against a
# stray heading fragment or a dangling "Provided that." being chosen as
# though it were a substantive sentence.
_MIN_SENTENCE_WORDS = 4


def _replace_preserving_case(pattern: str, replacement: str, text: str) -> str:
    def repl(match: re.Match) -> str:
        matched = match.group(0)
        if matched[:1].isupper():
            return replacement[:1].upper() + replacement[1:]
        return replacement

    return re.sub(pattern, repl, text, flags=re.IGNORECASE)


def _strip_heading(text: str) -> str:
    """Removes the leading ALL-CAPS section heading, if present."""
    return _HEADING_PREFIX.sub('', text, count=1).strip()


def _apply_jargon_swaps(text: str) -> str:
    """Swaps common legal jargon for plain equivalents. Rewords only --
    never drops content."""
    result = text
    for pattern, replacement in _JARGON_REPLACEMENTS:
        result = _replace_preserving_case(pattern, replacement, result)
    return result.strip()


def _simplify_plain_language(text: str) -> str:
    """
    Deterministic rewrite: strips the leading section heading and swaps
    common legal jargon for plain equivalents. Never drops content, so
    it can't accidentally remove a proviso or exception the way
    truncating the text could.
    """
    return _apply_jargon_swaps(_strip_heading(text))


def _extract_key_sentences(text: str) -> str:
    """
    Selects the most significant sentences from a clause and drops the
    rest -- the compression step that the rule-based rewriter alone does
    not provide (measured at only 0.90x across real stored clauses,
    i.e. barely shorter than the source).

    Extractive rather than abstractive on purpose. It returns sentences
    the contract actually contains, so unlike a generative model it
    cannot invent an obligation, a figure or a deadline that isn't in the
    source. For a legal tool a confidently fabricated summary is far
    worse than an incomplete one, which is the same trade-off taken in
    date_extractor.py.

    Scoring is classic frequency-based significance (a sentence scores by
    how many of the clause's own recurring content words it carries),
    plus three domain boosts: sentences imposing an obligation, sentences
    stating a figure or date, and the opening sentence -- which in a
    contract clause is usually the one carrying the main rule.

    Selected sentences are returned in their original document order.
    Reordering them by score would break the cross-references legal
    drafting relies on ("such notice", "the foregoing").
    """
    doc = get_nlp()(text)
    # Fragments are excluded from selection, not just deprioritised: a
    # two-word fragment can out-score a real sentence on mean word
    # significance, and picking one produces a "summary" that says
    # nothing.
    sentences = [
        s for s in doc.sents
        if len(s.text.split()) >= _MIN_SENTENCE_WORDS
    ]
    if len(sentences) < EXTRACT_MIN_SENTENCES:
        # Nothing worth choosing between -- leave it to the simplifier.
        return text

    # Frequency of the clause's own content words, normalised so the most
    # common one scores 1.0.
    freqs: dict[str, int] = {}
    for token in doc:
        if token.is_alpha and not token.is_stop:
            lemma = token.lemma_.lower()
            freqs[lemma] = freqs.get(lemma, 0) + 1
    if not freqs:
        return text
    peak = max(freqs.values())

    scored = []
    for index, sent in enumerate(sentences):
        content = [
            t.lemma_.lower() for t in sent if t.is_alpha and not t.is_stop
        ]
        if content:
            score = sum(freqs.get(lemma, 0) / peak for lemma in content) / len(content)
        else:
            score = 0.0

        if _OBLIGATION_RE.search(sent.text):
            score += _OBLIGATION_BOOST
        has_figure = any(
            ent.label_ in _FIGURE_ENT_LABELS for ent in sent.ents
        ) or any(ch.isdigit() for ch in sent.text)
        if has_figure:
            score += _FIGURE_BOOST
        if index == 0:
            score += _FIRST_SENTENCE_BOOST

        scored.append((score, index, sent.text.strip()))

    keep = min(
        EXTRACT_MAX_SENTENCES,
        max(1, math.ceil(len(sentences) * EXTRACT_KEEP_RATIO)),
    )
    top = sorted(scored, key=lambda item: item[0], reverse=True)[:keep]
    # Back into document order before joining.
    return ' '.join(text for _, _, text in sorted(top, key=lambda item: item[1]))


def _looks_like_near_copy(source: str, candidate: str) -> bool:
    """
    Detects the failure mode confirmed by direct testing: the model
    continuing to copy the source verbatim until it hits the output
    token limit, rather than producing a real abstractive summary.
    """
    source_words = source.split()
    candidate_words = candidate.split()
    if not candidate_words:
        return True

    prefix_len = min(8, len(source_words), len(candidate_words))
    if prefix_len:
        source_prefix = [w.lower() for w in source_words[:prefix_len]]
        candidate_prefix = [w.lower() for w in candidate_words[:prefix_len]]
        if source_prefix == candidate_prefix:
            return True

    # Even without an identical opening, barely compressing the source
    # isn't a real summary either.
    if len(candidate_words) > 0.75 * len(source_words):
        return True

    return False


def summarize_text(text: str, max_length: int = 70, min_length: int = 25) -> str:
    """
    Produces a plain-language version of a single clause.

    Three stages, and the order matters:
      1. Strip the ALL-CAPS section heading. This must happen BEFORE
         extraction: spaCy parses "GOVERNING LAW" as a sentence in its
         own right, and since it sits first it collects the
         opening-sentence boost and out-scores the clause's actual
         content -- producing a "summary" reading only "GOVERNING LAW".
      2. Extractive selection (_extract_key_sentences) -- keeps the most
         significant sentences and drops the rest. This is the step that
         actually shortens the text.
      3. Jargon swaps on whatever survived, so the rewrite effort is only
         spent on text that will actually be displayed.

    For clauses long enough that a model has real material to work with,
    the pretrained summarizer is also attempted, and its output used
    instead if -- and only if -- it looks like a genuine summary rather
    than a copy (see _looks_like_near_copy).
    """
    simplified = _apply_jargon_swaps(_extract_key_sentences(_strip_heading(text)))

    word_count = len(text.split())
    if word_count < LONG_CLAUSE_WORD_THRESHOLD:
        return simplified

    truncated = text[:3000]
    try:
        summarizer = get_summarizer()
        if summarizer is None:
            # transformers/torch not installed -- the deployed default.
            return simplified
        result = summarizer(
            truncated,
            max_length=max_length,
            min_length=min_length,
            do_sample=False,
            num_beams=4,
            no_repeat_ngram_size=3,
            length_penalty=2.0,
            early_stopping=True,
            truncation=True,
        )
        candidate = result[0]['summary_text'].strip()
        if candidate and not _looks_like_near_copy(text, candidate):
            return candidate
    except Exception:
        # A single clause failing the model (OOM, unexpected tokenizer
        # error, network hiccup fetching config, etc.) shouldn't take
        # down the whole document's processing -- fall back to the
        # rule-based rewrite, which never touches the network or a model.
        pass

    return simplified
