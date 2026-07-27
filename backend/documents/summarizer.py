"""
Plain-language summarization for the NLP Processing Subsystem
(Chapter 4, Section 4.3.3).

Uses a pretrained Hugging Face summarization model AS-IS — no
fine-tuning, per the implementation plan's scoped-down approach for the
two-week timeline. State this plainly in Chapter 4/5 rather than
implying the model was adapted to Nigerian legal language.

The model loads once per process (first request will be slow — several
seconds to load weights into memory — subsequent requests reuse it).
"""

from transformers import pipeline

_summarizer = None  # lazy-loaded, see get_summarizer()

# Small, fast model that runs reasonably on a laptop CPU. Swap for
# 'facebook/bart-large-cnn' if you have more RAM/time and want slightly
# higher-quality summaries — same interface, just slower to load and run.
MODEL_NAME = 'sshleifer/distilbart-cnn-12-6'


def get_summarizer():
    global _summarizer
    if _summarizer is None:
        _summarizer = pipeline('summarization', model=MODEL_NAME)
    return _summarizer


def summarize_text(text: str, max_length: int = 60, min_length: int = 15) -> str:
    """
    Generates a plain-language summary of a single clause.

    Very short input (a handful of words) is returned unchanged rather
    than sent to the model — summarization models tend to produce
    garbage or errors on trivially short input, and there's nothing
    meaningful to compress in a one-line clause anyway.
    """
    word_count = len(text.split())
    if word_count < 20:
        return text

    # distilbart has a ~1024 token input limit; truncate defensively so
    # a single unusually long clause doesn't crash the whole request.
    truncated = text[:3000]

    summarizer = get_summarizer()
    result = summarizer(
        truncated,
        max_length=max_length,
        min_length=min_length,
        do_sample=False,
    )
    return result[0]['summary_text'].strip()