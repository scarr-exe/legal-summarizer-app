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

**Second round of testing — the rewriter simplified but never
summarized.** The rule-based rewriter below fixed the copy-truncation
problem, but a later measurement across all 66 stored clauses showed it
was only reaching **0.90× of the original length** — 13 clauses came out
exactly the same length as their source. That is rewording, not
summarizing. An **extractive selection layer** (`_extract_key_sentences`)
was therefore added ahead of it, bringing the corpus to **0.67× mean /
0.63× median**, and a whole real tenancy agreement from 425 to 247 words
(0.58×).

Extractive rather than a second generative model, deliberately: it
returns sentences the contract actually contains, so unlike an abstractive
model it **cannot invent** an obligation, figure or deadline. That is the
same trade-off taken in `date_extractor.py`, and it matters more in a
legal tool than raw fluency does. Scoring is classic frequency-based
significance plus three domain boosts — sentences imposing an obligation
(`shall`/`must`/`may not`), sentences stating a figure or date, and the
opening sentence, which in a contract clause usually carries the main
rule. Selected sentences are re-joined **in original document order**,
because legal drafting cross-references earlier sentences ("such notice",
"the foregoing") and reordering by score would break those references.

Two bugs surfaced while building it, both caught by measuring rather than
eyeballing:

- **The heading was winning selection.** spaCy parses a clause's ALL-CAPS
  heading as a sentence in its own right; sitting first, it collected the
  opening-sentence boost and out-scored the actual content, so one
  clause's summary came out as literally `GOVERNING LAW` (0.04× — a
  50-word clause reduced to two words). Headings are now stripped
  *before* extraction rather than after, and the heading pattern was
  extended to cover the `RENEWAL.` form with a trailing period, which
  spaCy was also treating as a standalone sentence.
- **The minimum-sentence threshold was set too high.** At 3 sentences it
  skipped 66% of the corpus — measurement showed 48% of clauses are
  exactly two sentences and 18% are one. Lowered to 2. Dropping one of
  two sentences is safe here specifically because the UI always shows the
  original clause beside the summary; the summary is the gist, not a
  replacement for reading the clause.

A fragment guard (`_MIN_SENTENCE_WORDS`) also excludes sub-4-word
sentences from selection, since a short fragment can out-score a real
sentence on *mean* word significance.

**Honest limitation for Chapter 5:** this is extractive summarization —
it selects sentences, it does not paraphrase. It can therefore drop a
subordinate condition, which is precisely why the interface always
displays the original clause alongside. Single-sentence clauses (18% of
the corpus) cannot be compressed by sentence selection at all and are
only simplified.

**Fix adopted:** the summarization step is now a **hybrid**, not a pure
neural pipeline:

1. **Primary path (all clauses), three ordered stages** in
   `summarizer.py`:
   1. **Strip the heading** (`_strip_heading`) — e.g.
      `"REMUNERATION The Employer..."` → `"The Employer..."`. Must run
      first, for the reason above.
   2. **Extractive selection** (`_extract_key_sentences`) — keeps roughly
      half a clause's sentences (capped at 3), in document order. This is
      the step that actually shortens the text.
   3. **Jargon swaps** (`_apply_jargon_swaps`) — `shall` → `must`,
      `notwithstanding` → `despite`, `pursuant to` → `under`, etc.,
      applied only to what survived selection.
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

**Added beyond the plan: `GET`/`POST /api/evaluation-logs/`.** The
`EvaluationLog` model and serializer existed from Phase 1 but were never
wired to a view or URL, so there was no way to record the
usability/comprehension ratings Chapter 5's evaluation depends on.
`EvaluationLogListCreateView` closes that. Three things worth noting:

- The route lives in `config/urls.py` rather than `accounts/urls.py`,
  because that module is mounted under `/api/auth/` and an evaluation log
  isn't an auth resource.
- `user` is deliberately excluded from the serializer's `fields` and set
  in `perform_create()` from `request.user`. Otherwise a client could
  submit someone else's user id in the request body and attribute a
  rating to them.
- **Two validation gaps were found and closed while wiring this up.**
  The model's `rating` is a `PositiveSmallIntegerField` whose help_text
  documents a 1–5 Likert scale, but nothing enforced the ceiling, so
  `rating: 99` would have been accepted and silently skewed the Chapter 5
  figures. And nothing checked document ownership, so any authenticated
  user could POST an arbitrary document id and attach a rating to a
  stranger's contract. Both are now enforced in
  `EvaluationLogSerializer` (`min_value`/`max_value`, and
  `validate_document()`).

**Naming note for Chapter 4/5 consistency:** the field is called `rating`
in the code, not `comprehension_score`. Left as-is rather than renamed,
since the model and admin already use `rating` and it is documented there
as Likert-style. The table is currently empty, so renaming later is cheap
(one migration) if Chapter 4's data dictionary uses the other name —
worth checking which way round you want them to agree.

Covered by six tests in `accounts/tests.py`: anonymous rejection,
successful authenticated create, payload-`user` being ignored, evaluating
another user's document rejected, out-of-range ratings rejected, and list
scoping to own logs only.

---

## Phase 6 addition — derived contract dates

Chapter 4, Section 4.4.5 describes the detail endpoint as returning
"clauses + summaries + **derived dates**", but no date extraction existed
— the serializer exposed only `upload_date`, which is when the file was
uploaded, not a contract date. This blocked the timeline visualization
the plan asks for in Phase 5. Now implemented:

- `Document` gains nullable `start_date`, `end_date`, `renewal_date`
  (migration `0002`), exposed through `DocumentDetailSerializer`.
- `documents/date_extractor.py` runs spaCy NER over the clauses most
  likely to state contract dates (`duration`, `termination`, `renewal`)
  and resolves the `DATE` entities into real dates.

**The critical detail — and the reason this module is more defensive than
it first looks.** spaCy's `DATE` label covers durations as well as
calendar dates, so a single real tenancy clause yields entities like
`'1st August 2026'`, `'31st July 2027'`, `'a period of'`, `'months'`, and
`'30 days'`. Passing those to `dateutil` with `fuzzy=True` — the obvious
implementation — is actively dangerous, because fuzzy parsing fills
missing components from *today's date* instead of failing. Measured
against those exact spans:

```
'30 days'                     -> 2026-08-30   (month + year fabricated)
'twelve (12) calendar months' -> 2026-08-12   (fabricated entirely)
```

Both are durations, not dates, and both would have been written to the
`Document` as real contract dates — producing a confident, completely
wrong timeline. `_looks_like_calendar_date()` therefore requires an
explicit 4-digit year **and** a month indicator before a span reaches the
parser, plus a 1990–2100 sanity window afterwards. The regression tests
in `documents/tests.py` assert those exact spans stay rejected.

The deliberate consequence: this under-detects rather than over-detects.
A contract phrased in a way it doesn't recognise yields `None` and the UI
shows "no dates detected". That is the right trade-off — a missing
timeline is visibly missing, whereas a fabricated one is not. State this
plainly in Chapter 5 rather than claiming general date extraction.

Assignment rules are kept simple and explainable: a duration clause's
earliest date becomes `start_date` and its latest `end_date`; termination
clauses fill `end_date` only if the duration clause didn't; renewal
clauses supply `renewal_date`. A start later than the end means the two
dates came from unrelated sentences, so `end_date` is dropped rather than
rendering a backwards timeline.

**New dependency:** `python-dateutil`.

**Model bug found and fixed while adding the date fields:**
`Clause.ClauseType` was missing a `DURATION` choice entirely, even though
`clause_matcher.py` had been emitting `'duration'` since that category was
introduced. Django doesn't enforce `choices` at the database level, so
rows saved fine and it went unnoticed — but `get_clause_type_display()`
returned the raw slug instead of `'Duration'`, and `full_clean()` or the
admin would have rejected the value. Added in the same migration.

---

## Verification

- `python manage.py test` — 32/32 passing.
- Summarization compression measured across all 66 stored clauses:
  **0.90× → 0.67× mean, 0.63× median**, with no summary longer than its
  source. A real tenancy agreement reprocessed end-to-end went from 425
  to 247 words (0.58×) with its derived dates unchanged.
- `python manage.py check` — clean.
- End-to-end manual verification: a real tenancy PDF that previously
  extracted as one word per line, and a real employment DOCX whose
  summaries were previously truncated copies, were both re-uploaded
  through the live `/upload/` → `/process/` endpoints after the fixes and
  produced clean text, correct clause classification, and readable
  plain-language rewrites for every clause.
- Date extraction verified against the real stored contracts, not
  synthetic text: the tenancy agreement resolves to
  `start_date 2026-08-01` / `end_date 2027-07-31`, matching its "commence
  on 1st August 2026 … ending on 31st July 2027" wording, with
  `renewal_date` correctly null (that clause states "upon mutual written
  consent" and no absolute date). A non-contract PDF in the same set
  yields all-null rather than guessing.
- `/api/evaluation-logs/` verified live: 201 on valid create, 400 on
  `rating: 9`, 401 anonymous, and list scoped to the requester.

## Known outstanding items

- The neural-model quality ceiling above (documented, not a live bug —
  the hybrid approach means production output is already correct; only
  the *optional* long-clause neural path is affected).
- Date extraction only recognises absolute, explicitly-written dates.
  Relative phrasings ("30 days after signing", "the anniversary of this
  Agreement") are intentionally not resolved — see the fabrication risk
  above.
