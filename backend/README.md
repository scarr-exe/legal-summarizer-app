# Backend — Deviations from the Implementation Plan

This documents where the backend ended up differing from `Implementation_Plan.md`
(project root), and why. Two kinds of entries appear below: **deliberate
scope decisions** made while building each phase, and **bugs found during
real testing** that required design changes beyond what the plan anticipated.
Written to be lifted directly into Chapter 5's limitations/deviations
discussion.

---

## Phase 1 — Core Data Layer

- `Document` has two fields not in Chapter 4's data dictionary:
  `extracted_text` and `status`. Both are practical additions — `extracted_text`
  needs somewhere to live between extraction (Phase 2) and clause creation
  (Phase 3), and `status` lets the frontend distinguish uploaded/processing/
  complete/failed. Documented in `documents/models.py`'s module docstring as
  a deliberate, justifiable addition rather than a mismatch to hide.

## Phase 2 — Upload & Extraction Subsystem

Built as planned: PyPDF2 for PDF, python-docx for DOCX, extension + size
validation before extraction runs.

**Bug found in real testing, fixed in two passes:**

1. **First pass:** some PDFs cause PyPDF2 to insert a newline after every
   word instead of a normal space (e.g. `"RENT\nAND\nPAYMENT"` instead of
   `"RENT AND PAYMENT"`). Left unfixed, this breaks both clause
   classification (multi-word keyword phrases never match) and
   summarization (the model sees broken tokenization and produces garbled
   output). Added `_normalize_whitespace()` to collapse this while
   preserving real paragraph breaks and numbered-clause line breaks.

2. **Second pass, after uploading a real tenancy PDF:** the first fix's
   assumption — "two or more consecutive newlines always means a genuine
   paragraph break, worth preserving" — turned out to be wrong. For that
   PDF, PyPDF2 put a *blank line* between every single word
   (`"TENANCY\n\nAGREEMENT\n\nThis\n\nTenancy..."`), and the fix preserved
   every one of those as if it were a real paragraph break, passing the
   corruption straight through. Added `_looks_like_word_per_line()`: if
   blank-line-separated segments average under 4 words across more than 20
   segments, blank lines are treated as corruption (collapsed like any
   other whitespace) instead of structure. Verified against the real file
   — see "Verification" below.

## Phase 3 — NLP Pipeline

### Clause segmentation & classification

Built as planned: numbered-clause splitting → paragraph splitting →
spaCy-sentence-grouping, in that fallback order; keyword-based
classification rather than a trained classifier (unchanged scope decision
— still rule-based, documented in `clause_matcher.py`).

**Real-testing revisions to the classifier**, made iteratively:

- Added a `duration` category. A clause about the tenancy *term* was
  originally misclassified as `termination` for containing the word
  "terminated" once in passing.
- Classification stopped being first-match-wins by category order (a
  RENEWAL-titled clause containing the word "expiration" was being
  wrongly caught by `termination`'s keywords first). Now: check for an
  explicit heading at the start of the chunk first, and if none matches,
  score every category by keyword-match count and take the highest.
- **Bug found and fixed:** keyword matching used plain substring checks
  (`kw in text`), so short keywords matched inside unrelated words —
  `rent` inside "cur**rent**"/"diffe**rent**", `nda` inside "age**nda**".
  A clause with no payment or confidentiality content could still score
  points for those categories purely from incidental substrings.
  Reproduced directly (`current`/`different` → `payment`, `agenda` →
  `confidentiality` on unrelated text) before fixing. Switched to
  precompiled `\bword\b` word-boundary regex for every keyword and
  heading check. Also dropped the generic duration keyword `period of`,
  which collided with the termination keyword `notice period` (any
  termination clause saying "notice period of 30 days" was
  phantom-scoring duration too).

### Summarization — the largest deviation from the plan

The plan's assumption was: run each clause through
`transformers.pipeline("summarization")` using a pretrained model as-is
(`sshleifer/distilbart-cnn-12-6`), no fine-tuning, and that would produce
usable plain-language summaries. **This did not hold up under real
testing**, and the fix changes the architecture of this subsystem, not
just its parameters.

**What was observed:** every summary was a near-verbatim copy of the
clause's opening, cut off mid-sentence at the model's output length limit
— not a paraphrase or compression at all. Confirmed by direct inspection
of stored `Summary` rows against their source `Clause.original_text`.

**Diagnosis (tested directly against the model, not guessed):**

- Tried beam search, `no_repeat_ngram_size`, `length_penalty` — same
  copy-and-truncate behavior regardless of decoding strategy.
- Tried a deliberately long (229-word) clause, in case the model only
  needed more material to have something to compress — still produced a
  near-verbatim copy, just cut off later.
- Conclusion: this is not a parameter-tuning problem. `distilbart-cnn-12-6`
  is trained on CNN/DailyMail news-wire text and does not generalize to
  formal contract/legal register, especially not on the short (40–100
  word) clauses typical of this system's target documents.

**Fix adopted:** the summarization step is now a **hybrid**, not a pure
neural pipeline:

1. **Primary path (all clauses):** a deterministic rule-based
   plain-language rewriter (`_simplify_plain_language` in
   `summarizer.py`). It strips the leading ALL-CAPS section heading most
   clauses start with (e.g. `"REMUNERATION The Employer..."` →
   `"The Employer..."`) and swaps common legal jargon for plain
   equivalents (`shall` → `must`, `notwithstanding` → `despite`,
   `pursuant to` → `under`, etc). It **rewords, never drops content** —
   unlike compression, it can't silently cut a proviso or exception.
2. **Secondary path (clauses over ~130 words only):** the pretrained
   model is still attempted, since a long enough clause has more room for
   genuine compression to be possible. Its output is passed through
   `_looks_like_near_copy()` — a check for whether it just copied the
   source's opening words or barely shortened it at all — before being
   trusted. If it looks like a copy, the rule-based version is used
   instead.

This is a legitimate, defensible scope adjustment for a two-week timeline:
a deterministic rewrite that's honest about not compressing is more
useful and more trustworthy than a neural model producing text that looks
like a summary but isn't one. It should be described in Chapter 5 as a
deliberate departure from "pretrained model as-is," not as an unfinished
feature.

**Known limitation, documented in code rather than hidden:** legal
"shall" is ambiguous — sometimes obligation (`"the tenant shall pay"` →
`"must pay"`, correct) and sometimes just future tense (`"this agreement
shall commence"` → `"must start"`, grammatically awkward though not
wrong). Real disambiguation needs actual NLP beyond this system's scope;
the uniform `shall → must` mapping is a documented best-effort heuristic.

**Attempted but not completed, due to environment issues, not a design
problem:** tried swapping to `facebook/bart-large-cnn` (larger model) and
`sshleifer/distilbart-xsum-12-6` (trained on XSum, which specifically
optimizes against copying, unlike CNN/DailyMail) to see if either
generalizes better to legal text. Both download attempts failed on an
unreliable network connection (DNS failures, read timeouts) rather than
any code or compatibility issue. **To retry**: re-run the model swap test
once on a stronger connection — if `distilbart-xsum-12-6` genuinely
compresses rather than copies, it's a drop-in replacement for
`MODEL_NAME` in `summarizer.py`'s secondary path. Until then, production
behavior is safe either way, since the rule-based path is primary and the
near-copy check gates the neural path regardless of which model is
configured.

## Phase 4 — API Layer

Built as planned, with one gap closed: `accounts/views.py` and `urls.py`
were still Phase-0 stubs (only login/refresh existed, via SimpleJWT's
built-in views). Added `POST /api/auth/register/` (`RegisterSerializer` +
`RegisterView`), completing the register → login → refresh trio the plan
calls for. Covered by `accounts/tests.py` (register, weak-password
rejection, login, refresh, protected-endpoint access, unauthenticated
rejection — 6 tests, all passing).

Document endpoints, permission scoping (`Document.objects.filter(user=...)`
everywhere), and structured JSON output were already in place from Phase 3
and needed no changes.

**Added beyond the plan: `DELETE /api/documents/{id}/`.** The plan lists
only upload/list/detail/process; there was no way for a user to remove a
contract once uploaded, which made the dashboard accumulate failed and
duplicate test uploads with no recourse. `DocumentDeleteView`
(`generics.DestroyAPIView`) closes that gap. Two details worth noting for
the report:

- `get_queryset()` is filtered by `user`, so requesting another user's
  document id returns 404 rather than deleting it — the same ownership
  pattern used by the other document endpoints.
- Django stopped auto-deleting `FileField` files on model delete in 1.3,
  so `perform_destroy()` removes the stored file explicitly. Without it,
  every delete would orphan a file in `MEDIA_ROOT`. `Clause` and
  `Summary` rows need no such handling — both FKs are already
  `on_delete=CASCADE`.

Covered by `documents/tests.py`: successful delete with cascade
verification, cross-user delete returning 404, and unauthenticated delete
returning 401.

---

## Verification

- `python manage.py test` — 9/9 passing.
- `python manage.py check` — clean.
- End-to-end manual verification: a real tenancy PDF that previously
  extracted as one word per line, and a real employment DOCX whose
  summaries were previously truncated copies, were both re-uploaded
  through the live `/upload/` → `/process/` endpoints after the fixes and
  produced clean text, correct clause classification, and readable
  plain-language rewrites for every clause.

## Known outstanding items

- The neural-model quality ceiling above (documented, not a live bug —
  the hybrid approach means production output is already correct; only
  the *optional* long-clause neural path is affected).
- `EvaluationLog` has a model and serializer (`accounts/models.py`,
  `accounts/serializers.py`) but no view/URL wired yet — this is Phase 6
  scope (collecting evaluation ratings), not a Phase 1–4 gap.
