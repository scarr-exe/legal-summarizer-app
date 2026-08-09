# Evaluation Feature — Rating & Review

Documentation for the in-app rating widget and the admin screen that reads
its results. This is the mechanism that produces the usability /
comprehension data Chapter 5 reports, and the last buildable piece of the
plan's **Phase 6 — Integration Testing & Evaluation Data**.

---

## 1. What it does

After reading a document's plain-language summaries, a participant rates
how clear they were on a 1–5 scale and can optionally leave a comment.
Ratings are stored against the `EvaluationLog` model and read back from
the Django admin.

The rating is asked **on the document page, after the clause summaries** —
not in a separate survey — because a participant can only judge clarity
once they have actually read the output, and asking at that moment
removes the drop-off of a follow-up form.

---

## 2. Using it as a participant

1. Log in and open any processed document.
2. Scroll past the clause cards to **"How clear were these summaries?"**
3. Pick 1–5 stars. Each score carries a written label so the scale isn't
   ambiguous:

   | Score | Label |
   |---|---|
   | 1 | Not clear at all |
   | 2 | Slightly clearer |
   | 3 | Somewhat clearer |
   | 4 | Much clearer |
   | 5 | Completely clear |

4. A comment box appears once a score is chosen (optional).
5. Submit. The card switches to a confirmation showing the score given.

Returning to the same document later shows the saved rating rather than a
blank form, with a **Change** button to revise it.

---

## 3. Viewing results as admin

**URL:** `http://localhost:8000/admin/accounts/evaluationlog/`
**Login:** the superuser account (`scarr-exe`)

Start the server first:

```bash
cd backend
venv/Scripts/python.exe manage.py runserver
```

The screen shows a **summary panel** above the list with:

- total response count
- mean rating out of 5
- the full 1–5 distribution as a small bar chart

Those are the figures Chapter 5 needs, computed directly so they don't
have to be tallied by hand. The panel **respects whatever filters are
applied below it**, so filtering to a single document or date range
recomputes the mean for that subset.

The list itself shows user, document, rating, a truncated comment and the
timestamp. It can be filtered by rating or date, and searched by username,
filename, or comment text.

### Getting the raw data out

For a table in the appendix, the Django shell is usually easier than
copying from the admin:

```bash
cd backend
venv/Scripts/python.exe manage.py shell
```

```python
from accounts.models import EvaluationLog
from django.db.models import Avg, Count

EvaluationLog.objects.aggregate(n=Count('id'), mean=Avg('rating'))
list(EvaluationLog.objects.values('rating').annotate(n=Count('id')).order_by('-rating'))

for log in EvaluationLog.objects.select_related('user', 'document'):
    print(log.user.username, log.document.file_name, log.rating, log.comments)
```

---

## 4. What was built

### Backend

| File | Change |
|---|---|
| `accounts/models.py` | `UniqueConstraint` on `(user, document)` |
| `accounts/migrations/0002_evaluationlog_unique_evaluation_per_user_document.py` | The constraint migration |
| `accounts/serializers.py` | `create()` overridden to upsert |
| `accounts/admin.py` | Summary stats, comment column, filters, search |
| `accounts/templates/admin/accounts/evaluationlog/change_list.html` | Renders the summary panel |
| `accounts/tests.py` | 14 tests total for this app |

Endpoint (unchanged shape, already existed):

| Method | Endpoint | Behaviour |
|---|---|---|
| `POST` | `/api/evaluation-logs/` | Create **or update** the caller's rating for a document |
| `GET` | `/api/evaluation-logs/` | List only the caller's own ratings |

### Frontend

| File | Change |
|---|---|
| `components/EvaluationWidget.tsx` | **New** — the star widget and its submitted state |
| `lib/api.ts` | `EvaluationLog` type, `listEvaluations()`, `submitEvaluation()` |
| `app/documents/[id]/page.tsx` | Loads any existing rating and renders the widget |

---

## 5. Design decisions worth defending

**One rating per person per document, enforced in the database.** Without
it, a participant who submits twice is counted twice and quietly shifts
the mean Chapter 5 reports. The constraint makes double-counting
impossible rather than merely unlikely.

**Re-submitting updates instead of failing.** With the constraint alone, a
second submission would hit a 400 and read as a broken form. The
serializer upserts, so "Change" re-POSTs and overwrites. Verified live:
the row keeps its `id`, the rating changes, and the row count stays at one.

**`user` is never taken from the request body.** It comes from the
authenticated request, so a client can't attribute a rating to someone
else.

**Ratings are restricted to documents the requester owns.** Otherwise any
authenticated user could rate a stranger's contract by guessing an id.

**The rating is asked after the summaries, not before.** Placement is part
of the instrument: asking before the participant has read anything would
produce noise.

**The comment box only appears after a score is picked.** An empty
textarea presented up front makes the widget read as a chore and
suppresses response rate.

**Nothing blocks reading if the rating fails to load.** If the existing
rating can't be fetched, the widget falls back to an empty form rather
than erroring the whole page.

---

## 6. A bug this work surfaced

While running the suite after building the widget, an existing date test
failed — having passed the day before. `_parse_span('August 2026')`
returned **2 August** that day and **1 August** the day before.

`dateutil` fills any date component the text omits from **today's date**.
A month-and-year span has no day, so the day came from the clock. The
visible symptom was trivial; the real defect was that **reprocessing the
same contract on different days would store different contract dates** —
non-deterministic pipeline output.

Fixed by anchoring the parser to a fixed date (`_PARSE_ANCHOR`) so an
omitted day is always the 1st. Existing stored dates were unaffected, as
the real contracts all state complete dates. A regression test pins the
behaviour.

Worth a line in Chapter 5: it is a good example of a defect that only
surfaces because tests assert exact values and get run on more than one
day.

---

## 7. Testing

- **35 backend tests, all passing** (21 `documents`, 14 `accounts`).
- Evaluation-specific coverage: anonymous rejected, authenticated create,
  payload `user` ignored, another user's document rejected, out-of-range
  ratings rejected, list scoped to own rows, **re-submission updates
  rather than duplicates**, and **different users can rate the same
  document**.
- Verified live end-to-end: `201` on create, `201` on re-submit with the
  same row id and updated score, one row total, and the admin panel
  rendering "1 response, mean rating 5.0 / 5".
- Frontend: `tsc --noEmit` clean, production build succeeds.

Run them with:

```bash
cd backend
venv/Scripts/python.exe manage.py test
```

---

## 8. Running an evaluation session

The plan asks for 5–8 respondents. A workable procedure:

1. Create an account for each participant (or let them register).
2. Give each the same one or two sample contracts to upload, so ratings
   are comparable across people.
3. Ask them to read the summaries properly before rating — the score is
   meant to compare the summary against the original clause, which the
   interface shows side by side.
4. Encourage a comment; the free text is usually more useful in a write-up
   than the number.
5. Read the totals off the admin summary panel once everyone is done.

**Note on interpretation:** a participant can only rate a document they
own, so each person rates their own upload of the sample contract rather
than a shared record. Ratings are still comparable — the contract and the
generated summaries are identical — but the `document` ids will differ per
participant. Worth stating in the methodology so the data isn't
misread as ratings of separate documents.

**Still outstanding for Phase 6:** the responses themselves (the table is
currently empty), and appendix screenshots — which need retaking anyway,
since the interface was redesigned after the earlier ones.
