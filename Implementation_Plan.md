# Implementation Plan — Interactive Legal Document Summarization System

Two-week build plan, mapped to the architecture in Chapter 3 and the modules in Chapter 4. Written for vibecoding with Claude Code / Copilot — each phase is scoped to be buildable in a day or two with AI assistance, not from scratch.

**Reality check first:** with two weeks to a defense, your goal is a working, demoable system that matches what Chapters 3–4 describe — not a production-grade platform. Cut anything that doesn't help the demo or the evaluation chapter. Recommended cuts are flagged below.

---

## Phase 0 — Setup (Day 1, half day)

- Init two repos or one monorepo: `backend/` (Django) and `frontend/` (Next.js)
- Django project + DRF + SimpleJWT installed, PostgreSQL connected (local is fine — no need to deploy yet)
- Next.js project + Tailwind installed
- Git repo with a clean commit history from the start — you'll want this as evidence of iterative Agile sprints in your report/demo
- Decide now: **use a pretrained summarization model as-is (e.g. `facebook/bart-large-cnn` or `sshleifer/distilbart-cnn`) — do not fine-tune anything.** Fine-tuning is a multi-week task on its own and isn't necessary to demonstrate the system works.

**Cut:** don't build user registration flows beyond the basics. A single test user or two is enough.

---

## Phase 1 — Core Data Layer (Day 1–2)

Build the five tables from Chapter 4's data dictionary directly as Django models: `User` (use Django's built-in, extended if needed), `Document`, `Clause`, `Summary`, `EvaluationLog`.

- Django models + migrations
- Django admin enabled for all models (free CRUD UI for you to inspect data during debugging — huge time saver)
- Basic DRF serializers for Document, Clause, Summary

**Prompt pattern for Claude Code:** give it the data dictionary table from Chapter 4 directly and ask it to generate the Django models + migrations + serializers in one pass. This is a mechanical task AI handles well with minimal review needed beyond checking foreign keys.

---

## Phase 2 — Upload & Extraction Subsystem (Day 2–3)

- `POST /api/documents/upload/` endpoint: accepts PDF/DOCX, validates type + size
- Text extraction: PyPDF2 for PDF, python-docx for DOCX
- Store raw extracted text + Document metadata

**Test as you go:** upload 2–3 real sample contracts (a tenancy agreement, an internship offer letter) early and keep reusing them through every phase. Having consistent test documents makes every later phase (and your evaluation chapter) easier.

---

## Phase 3 — NLP Pipeline (Day 3–6, the core risk)

This is the phase most likely to eat your time budget, so front-load it.

1. **Clause segmentation first, simply.** Don't over-engineer clause "identification" — a reasonable approach for your timeline: split extracted text into paragraphs/sections using spaCy sentence segmentation, then classify each chunk into a clause type using a small rule-based keyword matcher (e.g. chunk containing "terminate", "notice period" → termination; "rent", "deposit" → payment) rather than training a classifier. This is defensible in your report as a lightweight/heuristic classification approach and is realistic for two weeks.
2. **Summarization second.** Run each clause chunk through the Hugging Face summarization pipeline (`transformers.pipeline("summarization")`). Cache the model locally after first download — don't re-download per request.
3. Wire it together: `TextPreprocessor` (spaCy) → `IDENTIFY_CLAUSES` (rule-based) → `SummarizationEngine` (Transformers) → store `Clause` + `Summary` rows.

**Cut, and say so honestly in Chapter 5's limitations:** true ML-based clause classification (as implied more ambitiously in Ch2/Ch3) is out of scope for two weeks. A rule-based classifier feeding a real transformer summarizer is a legitimate, working system — and it's normal for a final-year project to simplify one layer while keeping the rest faithful to the design.

**Prompt pattern:** ask Claude Code to build this as one Django service module (`nlp/pipeline.py`) with three clearly separated functions matching the pseudocode in Chapter 4.4.6, so the code structure visibly maps to your document.

---

## Phase 4 — API Layer (Day 6–7)

- `GET /api/documents/{id}/summary/` — returns the structured JSON (clauses + summaries + derived dates) described in Chapter 4.4.5
- `GET /api/documents/` — list/history
- Auth endpoints via SimpleJWT (register, login, refresh)
- Basic permission checks: a user can only fetch their own documents

---

## Phase 5 — Frontend (Day 7–11)

Build in this order, each one a working vertical slice before moving to the next:

1. Auth pages (login/register) — keep minimal, no password reset flow
2. Upload page — file picker, upload progress, redirect to summary view on completion
3. Summary view — list of clauses, original text vs. plain-language summary, side-by-side
4. Dashboard/history — list of past uploads (this is your Chapter 4.2 "Control Centre")
5. Visualization — this can be the simplest Recharts component that still satisfies the design: a timeline bar for contract start/end/renewal dates, and a bar or pie chart of clause-type distribution. Don't over-build this; one or two charts are enough to match Chapter 4's design and give you demo visuals.

**Cut:** search/filter across clauses is nice-to-have — implement only if Phase 1–4 finish early. It's better to demo a smaller working system than a half-built larger one.

---

## Phase 6 — Integration Testing & Evaluation Data (Day 11–13)

- Run your 2–3 test contracts through the full pipeline end-to-end, fix breakage
- This is also when you collect the evaluation data Chapter 5 needs: have a handful of people (classmates, friends) use the system on a sample contract and rate comprehension/usability. Even 5–8 respondents is workable for a final-year evaluation — plan this now, not the night before defense, since you need time to write it up.
- Take your screenshots for the appendix now, while the system is stable

---

## Phase 7 — Polish & Defense Prep (Day 13–14)

- Fix visual rough edges, not new features
- Prepare a scripted demo flow (upload → summary → visualization) that you rehearse — don't improvise live with an unfamiliar UI in front of examiners
- Slides/talking points that map directly to Chapters 3–4: "here is the architecture diagram, here is the running system"
- Have a backup: a short screen recording of the demo working, in case of live-demo failure (Wi-Fi, model load time, etc.)

---

## Summary Table

| Phase | Days | Deliverable |
|---|---|---|
| 0 | 1 (half) | Project scaffolding |
| 1 | 1–2 | Database models |
| 2 | 2–3 | Upload + extraction |
| 3 | 3–6 | NLP pipeline (highest risk) |
| 4 | 6–7 | API layer |
| 5 | 7–11 | Frontend |
| 6 | 11–13 | Integration + evaluation data |
| 7 | 13–14 | Polish + defense prep |

---

## Things to explicitly simplify vs. Chapter 3/4 (write these into Chapter 5's limitations honestly)

- Clause classification: rule-based keyword matching, not a trained ML classifier
- No fine-tuning of the summarization model — pretrained model used as-is
- Minimal auth flow, no password reset
- Search/filter across clauses only if time permits
- Deployment: local/dev server demo is acceptable for defense; cloud deployment is optional, not required
