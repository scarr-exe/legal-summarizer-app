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

import re

from transformers import pipeline

_summarizer = None  # lazy-loaded, see get_summarizer()

# Kept for the rare long clause where genuine compression is worth
# attempting -- see module docstring for why this is a secondary path,
# not the primary one.
MODEL_NAME = 'sshleifer/distilbart-cnn-12-6'

# Below this word count, a clause is short enough that the pretrained
# model has essentially nothing to compress -- skip straight to the
# rule-based rewrite rather than pay the model's cost for no benefit.
LONG_CLAUSE_WORD_THRESHOLD = 130


def get_summarizer():
    global _summarizer
    if _summarizer is None:
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
_HEADING_PREFIX = re.compile(r'^(?:[A-Z][A-Z\-]*\s+){1,8}(?=[A-Z][a-z])')


def _replace_preserving_case(pattern: str, replacement: str, text: str) -> str:
    def repl(match: re.Match) -> str:
        matched = match.group(0)
        if matched[:1].isupper():
            return replacement[:1].upper() + replacement[1:]
        return replacement

    return re.sub(pattern, repl, text, flags=re.IGNORECASE)


def _simplify_plain_language(text: str) -> str:
    """
    Deterministic rewrite: strips the leading section heading and swaps
    common legal jargon for plain equivalents. Never drops content, so
    it can't accidentally remove a proviso or exception the way
    truncating the text could.
    """
    result = _HEADING_PREFIX.sub('', text, count=1)
    for pattern, replacement in _JARGON_REPLACEMENTS:
        result = _replace_preserving_case(pattern, replacement, result)
    return result.strip()


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

    Always applies the rule-based rewrite first. For clauses long enough
    that real compression is possible, also attempts the pretrained
    model and uses its output instead if -- and only if -- it actually
    looks like a genuine summary rather than a copy (see
    _looks_like_near_copy).
    """
    simplified = _simplify_plain_language(text)

    word_count = len(text.split())
    if word_count < LONG_CLAUSE_WORD_THRESHOLD:
        return simplified

    truncated = text[:3000]
    try:
        summarizer = get_summarizer()
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
