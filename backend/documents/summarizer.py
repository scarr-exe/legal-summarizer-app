"""
Plain-language summarization for the NLP Processing Subsystem
(Chapter 4, Section 4.3.3).

CHANGE FROM THE FIRST VERSION: the short-text threshold was raised from
20 words to 40. In the first test run, a 40-word preamble chunk ("This
Tenancy Agreement is made this 1st day of August 2026, between...")
was sent to the model and came back with a fabricated date
("August 26, 2007") that appears nowhere in the source text —
classic hallucination on input that's too short/narrative for a
summarization model to compress meaningfully. Passing such chunks
through unchanged is safer than risking fabricated content in a legal
document summarizer, where invented details are a worse failure than
an unsummarized passthrough.

Uses a pretrained Hugging Face summarization model AS-IS — no
fine-tuning, per the implementation plan's scoped-down approach for the
two-week timeline. State this plainly in Chapter 4/5 rather than
implying the model was adapted to Nigerian legal language.
"""

from transformers import pipeline

_summarizer = None  # lazy-loaded, see get_summarizer()

MODEL_NAME = 'sshleifer/distilbart-cnn-12-6'

# Chunks shorter than this are returned unchanged rather than
# summarized. Raised from 20 -> 40 after observing hallucination on
# short preamble/narrative text (see module docstring).
MIN_WORDS_FOR_SUMMARIZATION = 40


def get_summarizer():
    global _summarizer
    if _summarizer is None:
        _summarizer = pipeline('summarization', model=MODEL_NAME)
    return _summarizer


def summarize_text(text: str, max_length: int = 60, min_length: int = 15) -> str:
    """
    Generates a plain-language summary of a single clause.

    Text shorter than MIN_WORDS_FOR_SUMMARIZATION is returned unchanged —
    summarization models tend to hallucinate or produce near-meaningless
    output on short/narrative input, and there's little to compress in a
    short clause anyway.
    """
    word_count = len(text.split())
    if word_count < MIN_WORDS_FOR_SUMMARIZATION:
        return text

    # distilbart has a ~1024 token input limit; truncate defensively so
    # a single unusually long clause doesn't crash the whole request.
    # truncation=True below is the real safety net (it truncates at the
    # tokenizer level, which is what actually matters); the char slice
    # here just avoids handing the tokenizer an enormous string first.
    truncated = text[:3000]

    # Scale max_length down for shorter clauses so the model isn't
    # asked to "expand" a short input into a needlessly long summary.
    effective_max = min(max_length, max(min_length + 10, word_count // 2))

    summarizer = get_summarizer()
    try:
        result = summarizer(
            truncated,
            max_length=effective_max,
            min_length=min_length,
            do_sample=False,
            truncation=True,
        )
        return result[0]['summary_text'].strip()
    except Exception:
        # A single clause failing the model (OOM, unexpected tokenizer
        # error, etc.) shouldn't take down the whole document's
        # processing — fall back to the original text, consistent with
        # the "unsummarized passthrough over fabricated content" stance
        # already taken above for short clauses.
        return text