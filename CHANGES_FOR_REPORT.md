# What Changed — Report Update Checklist

A condensed list of everything added or changed since the original
`Implementation_Plan.md`, written so you can update Chapters 3–5 without
reading the full deviation write-ups. Those live in `backend/README.md`
and `frontend/README.md` and hold the detailed reasoning; this file is
just the diff.

Each section says which chapter it affects.

---

## 1. Data dictionary changes → **Chapter 4.4.7**

`Document` gains five fields beyond the original dictionary table:

| Field | Type | Why |
|---|---|---|
| `extracted_text` | `TextField` | Somewhere to hold extracted text between extraction and clause creation |
| `status` | `CharField` | uploaded / processing / complete / failed, so the UI can show progress |
| `start_date` | `DateField` (null) | Derived contract dates — the "derived dates" 4.4.5 already promised |
| `end_date` | `DateField` (null) | " |
| `renewal_date` | `DateField` (null) | " |

`Clause.ClauseType` gains a sixth choice: **`duration`**.

> This one is a correction, not an addition. The classifier had been
> emitting `'duration'` since that category was introduced, but the
> model's `choices` list never included it. Django doesn't enforce
> `choices` at the database level so rows saved fine and it went
> unnoticed — but `get_clause_type_display()` returned the raw slug and
> `full_clean()`/admin would have rejected the value. If your Chapter 4
> lists five clause types, it now needs six.

`EvaluationLog` is unchanged structurally, but note the field is named
**`rating`**, not `comprehension_score`. If your data dictionary says the
latter, pick one — the table is currently empty, so renaming is a single
cheap migration.

---

## 2. New / changed modules → **Chapter 3 (architecture), Chapter 4.3**

### Backend

| Module | Status | Role |
|---|---|---|
| `documents/extraction.py` | changed | Added whitespace normalisation for corrupted PDF text |
| `documents/clause_matcher.py` | changed | Word-boundary matching; heading detection; scoring instead of first-match |
| `documents/summarizer.py` | **substantially rewritten** | Now extractive selection + rule-based rewrite, with the neural model demoted to an optional path |
| `documents/date_extractor.py` | **new** | spaCy NER + strict date parsing → derived contract dates |
| `documents/pipeline.py` | changed | Calls date extraction; resets dates on reprocess |

If your Chapter 3 architecture diagram shows the NLP subsystem, it now
has **four** components rather than three:

```
TextPreprocessor → IDENTIFY_CLAUSES → SummarizationEngine → DateExtractor
     (spaCy)         (rule-based)      (extractive + rules)   (spaCy NER)
```

### Frontend

New components worth naming in a UI chapter: `ContractTimeline`,
`ClauseTypeChart`, `ClauseFilters`, `ConfirmDialog`, `Reveal`,
`AuthShell`, `StatusBadge`, `Logo`. Shared logic in `lib/api.ts`,
`lib/auth-context.tsx`, `lib/clause-types.ts`.

---

## 3. API endpoints → **Chapter 4.4.5**

Full current surface. Bold rows are new since the plan.

| Method | Endpoint | Notes |
|---|---|---|
| POST | `/api/auth/register/` | **New** — plan assumed it existed; it was a stub |
| POST | `/api/auth/login/` | SimpleJWT |
| POST | `/api/auth/refresh/` | SimpleJWT |
| POST | `/api/documents/upload/` | |
| POST | `/api/documents/{id}/process/` | |
| GET | `/api/documents/` | |
| GET | `/api/documents/{id}/summary/` | Now also returns `start_date`, `end_date`, `renewal_date` |
| DELETE | **`/api/documents/{id}/`** | **New** — not in the plan at all |
| GET, POST | **`/api/evaluation-logs/`** | **New** — model existed, was never wired to a view |

All document endpoints scope by owner, so another user's id returns 404
rather than leaking or mutating data.

---

## 4. Dependencies → **Chapter 4 (tools/technologies)**

One addition: **`python-dateutil`** (date parsing for the timeline).

Everything else is unchanged from the plan: Django, DRF, SimpleJWT,
PostgreSQL, spaCy (`en_core_web_sm`), Hugging Face Transformers,
PyPDF2, python-docx, Next.js, Tailwind, Recharts.

---

## 5. Numbers you can cite → **Chapter 4 / Chapter 5**

All measured against the real corpus in the database, not synthetic
examples:

| Metric | Value |
|---|---|
| Automated tests | **35**, all passing (21 `documents`, 14 `accounts`) |
| Clauses in corpus | 66 across several contracts |
| Summary compression, before extractive layer | 0.90× (i.e. barely shorter) |
| Summary compression, after | **0.67× mean, 0.63× median** |
| Full tenancy agreement, end to end | 425 → 247 words (**0.58×**) |
| Summaries longer than their source | **0** |
| Clause length distribution | 18% one sentence, 48% two, 34% three or more |
| Clauses long enough to trigger the neural path | 2 of 63 (~3%) |

Date extraction, verified on a real tenancy agreement:
`start_date 2026-08-01`, `end_date 2027-07-31`, `renewal_date null` —
matching its "commence on 1st August 2026 … ending on 31st July 2027"
wording, with the renewal clause correctly yielding nothing because it
states "upon mutual written consent" and no absolute date.

---

## 6. Limitations to state honestly → **Chapter 5**

These are all deliberate engineering trade-offs. Stating them is
stronger than letting an examiner find them.

1. **Clause classification is rule-based keyword matching**, not a
   trained ML classifier. (Already in the plan's own cut list.)

2. **Summarization is extractive, not abstractive.** It selects the
   clause's own sentences rather than paraphrasing, so it can drop a
   subordinate condition. This is why the interface always shows the
   original clause beside the summary. Chosen over a generative model
   specifically because an extractive summary **cannot fabricate** an
   obligation, figure or deadline.

3. **Single-sentence clauses (18% of the corpus) are not compressed** —
   sentence selection has nothing to select. They are only simplified.

4. **The pretrained summarization model does not generalise to legal
   text.** Tested directly: `distilbart-cnn-12-6` produced near-verbatim
   copies truncated at the token limit, regardless of beam search,
   `no_repeat_ngram_size` or `length_penalty`, and on inputs up to 229
   words. It is retained only as an optional path for clauses over 130
   words, gated by a near-copy check. No fine-tuning was performed.

5. **Date extraction only recognises absolute, explicitly written
   dates.** Relative phrasings ("30 days after signing", "the
   anniversary of this Agreement") are deliberately not resolved — see
   the fabrication risk in §7 below.

6. **JWTs are stored in `localStorage`**, which trades XSS resistance
   for implementation simplicity. `httpOnly` cookies via Next.js proxy
   routes would be more secure but need a proxy per endpoint.

7. **No password reset flow.** (Plan's own cut.)

8. **Deployment.** The plan treated a local/dev-server demo as
   acceptable. The project is now configured for a real deployment
   (Railway for the Django API + PostgreSQL, Vercel for the Next.js
   frontend) — see `DEPLOYMENT.md`. Note that the **deployed build
   omits the optional neural summarization path**: `torch` is ~1.0GB
   and the model a further 1.2GB re-downloaded on every cold start,
   for a path that fires on ~3% of clauses and usually loses its
   quality check. The deterministic extractive + rule-based pipeline
   is unaffected and is what produces every summary shown.

---

## 7. Bugs found and fixed — worth a paragraph in **Chapter 5**

These make good "testing revealed…" material because each was found by
measuring rather than assuming, and each had a silent failure mode.

| Bug | Symptom | Why it mattered |
|---|---|---|
| PDF word-per-line corruption | PyPDF2 put a blank line between every word | Broke classification *and* summarization; two fixes needed, because the first assumed blank lines always meant paragraph breaks |
| Substring keyword matching | `rent` matched inside "cur**rent**", `nda` inside "age**nda**" | Clauses with no payment/confidentiality content scored for those categories |
| `dateutil` fuzzy parsing fabricated dates | `'30 days'` → `2026-08-30`; `'twelve (12) calendar months'` → `2026-08-12` | Fuzzy parsing fills missing parts from *today* rather than failing — would have produced a confident, wrong timeline |
| Heading won extractive selection | One clause's summary was literally `GOVERNING LAW` | spaCy parses an ALL-CAPS heading as its own sentence; first position gave it a scoring boost |
| Missing `duration` model choice | Silent — rows saved anyway | `get_clause_type_display()` wrong; admin/`full_clean()` would reject |
| Unbounded `rating` | `rating: 99` accepted | Would have skewed your own evaluation figures |
| Unscoped evaluation `document` | Any user could rate a stranger's contract | Ownership was never checked |
| JWT refresh not persisted | Reload after silent refresh used a stale token | Wasted a round trip; recovered but was plainly wrong |

---

## 8. Plan items previously cut, now delivered

| Item | Plan's position | Now |
|---|---|---|
| Search/filter across clauses | "nice-to-have, only if Phase 1–4 finish early" | **Built** — search + type filters on the summary view |
| Timeline visualization | Phase 5 deliverable | **Built** — was blocked on backend date extraction, which didn't exist |
| EvaluationLog endpoint | Implied by Phase 1 + Chapter 5 | **Built**, plus an in-app rating widget and an admin summary panel — see `EVALUATION_FEATURE.md` |
| Document delete | Not in the plan | **Built** |

Phase 5's five deliverables are all complete, plus the optional sixth.

---

## 9. Still open

- **Alternative summarization models untested.** `bart-large-cnn` and
  `distilbart-xsum-12-6` were both attempted; both downloads failed on an
  unreliable connection, not on any code issue. Not required — the
  extractive layer delivers the compression — but if you want Chapter 5
  to say alternatives were empirically evaluated rather than reasoned
  about, retry on a good connection. A 605MB partial download is sitting
  in the Hugging Face cache and can be deleted.
- **Evaluation data not yet collected.** The rating widget, the endpoint
  and the admin read-out are all built and tested; the responses
  themselves need real participants. See `EVALUATION_FEATURE.md` §8.
- **Appendix screenshots need retaking**, since the interface was
  redesigned after the earlier ones.
