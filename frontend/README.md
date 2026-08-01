# Frontend — Deviations from the Implementation Plan

Companion to `backend/README.md`. This documents where the Next.js
frontend ended up differing from `Implementation_Plan.md` (project root),
and why. Same two categories as the backend doc: **deliberate scope
decisions**, and **problems found during real use** that forced changes
beyond what the plan anticipated. Written to be lifted into Chapter 5's
deviations/limitations discussion.

Stack as planned: Next.js (App Router) + Tailwind + Recharts, talking to
the Django API over JWT. No additional runtime dependencies were added
beyond what Phase 0 installed.

**Running it:** `npm run dev` (expects the Django API on
`http://localhost:8000`; override via `NEXT_PUBLIC_API_URL` in
`.env.local`).

---

## Phase 5 — Frontend

The plan lists five deliverables, built in order, plus one item ("search/
filter across clauses") explicitly marked optional. Four of the five were
built as described; the fifth (visualization) is partially blocked (see
below); the optional sixth was added later, once time allowed.

### 1. Auth pages — built, with one decision the plan left open

Login and register pages, minimal, no password reset — as scoped.

**The plan does not say where the JWT should live**, which is the single
most consequential frontend decision, so it is recorded here. Two options
were considered:

- **`localStorage` + React Context** (chosen) — client components call
  the Django API directly. Simple, matches the decoupled Next+DRF shape,
  and fits the two-week budget.
- **`httpOnly` cookies via Next.js Route Handler proxies** (rejected) —
  more secure against XSS, but needs a proxy route per backend endpoint
  plus cookie session plumbing, which is meaningfully more code than
  Phase 5's budget allows.

**Honest limitation for Chapter 5:** tokens in `localStorage` are
readable by any JavaScript running on the page, so this design trades XSS
resistance for simplicity. A deliberate, documented scope decision rather
than an oversight.

**Beyond the plan — silent token refresh.** The plan says "auth endpoints
via SimpleJWT (register, login, refresh)" but never says what the
frontend should *do* with the refresh token. Since the access token
expires after 1 hour (`SIMPLE_JWT.ACCESS_TOKEN_LIFETIME`), the naive
behaviour would be to dump the user back to the login screen mid-session.
`lib/auth-context.tsx` instead schedules a background refresh one minute
before expiry, and `getValidAccessToken()` re-checks expiry immediately
before every API call. The user is only logged out if the refresh itself
fails.

**Two real bugs found and fixed in that refresh logic** (both surfaced by
lint; both would have been intermittent and hard to reproduce by hand):

- `applyTokens` was referenced inside `scheduleRefresh` before it was
  declared, creating a circular `useCallback` dependency where one
  closure captured a stale version of the other. Restructured to use refs
  to break the cycle.
- The scheduled refresh never wrote the rotated access token back to
  `localStorage`. Because `ROTATE_REFRESH_TOKENS` is on, a page reload
  after a background refresh would rehydrate from a stale token. It
  recovered on the next request, but wasted a round trip and was plainly
  wrong. Now persisted on every refresh.

### 2. Upload page — built, but as a two-stage flow

The plan describes "file picker, upload progress, redirect to summary
view on completion" as though upload were a single operation. It is not:
the backend deliberately splits `POST /upload/` (fast — extraction only)
from `POST /{id}/process/` (slow — clause identification and
summarization), so the upload response doesn't hang on the NLP pipeline.

The page therefore shows a **two-step progress checklist** ("Extracting
text" → "Identifying clauses & summarizing") rather than one progress
bar, then redirects. Drag-and-drop was added alongside the file picker.

### 3. Summary view — built, then substantially reworked

Original text vs. plain-language summary side by side, as planned. Two
changes after seeing it against real multi-clause contracts:

- **Layout.** The first version was a single `max-w-3xl` column, which
  wasted most of a desktop screen and turned an 8–12 clause contract into
  a very long scroll. Now `max-w-7xl` with clauses in a two-column grid,
  each card splitting original/summary at wider breakpoints.
- **Ordering.** Clauses rendered in raw document order, so unclassified
  `other` clauses were interleaved with identified ones and pushed the
  useful content down. Display order now puts identified clause types
  first and `other` last (`sortClausesForDisplay` in
  `lib/clause-types.ts`), preserving document order within each group.
  Cards still label each clause with its original document position, so
  the true order stays traceable.

### 4. Dashboard / history — built as planned

The Chapter 4.2 "Control Centre": table of past uploads with status
badges, skeleton loading states, and a designed empty state.

**Beyond the plan — delete.** The plan has no delete capability, so the
dashboard accumulated failed and duplicate uploads with no way to clear
them. Added a per-row delete (and one on the document page), both behind
a confirm dialog. Backed by a new `DELETE /api/documents/{id}/` endpoint
— see `backend/README.md` for the server-side notes.

### 5. Visualization — both charts now built

The plan asks for **two** charts. Both exist, though the second arrived
later than the first:

1. "a bar or pie chart of clause-type distribution" — **built.**
   `components/ClauseTypeChart.tsx`: a horizontal bar chart with
   per-category colours, value labels, and a summary stat row.
2. "a timeline bar for contract start/end/renewal dates" — **built,
   later.** `components/ContractTimeline.tsx`.

**The timeline was blocked on the backend for most of the build**, and is
worth describing that way in Chapter 5 rather than as a straightforward
Phase 5 item. The plan's Phase 4 describes the detail endpoint as
returning "clauses + summaries + **derived dates**", but no date
extraction existed — the serializer exposed only `upload_date`, which is
when the *file* was uploaded, not a contract date, so it could not stand
in. The frontend work was never the hard part. Date extraction was added
afterwards (`documents/date_extractor.py`; see `backend/README.md` for
why that module is unusually defensive), which unblocked this.

Implementation notes:

- **Plain markup, not Recharts.** This is one date range with two or
  three point markers, which Recharts has no native chart type for.
  Forcing it into a bar chart would have been more code and less control
  than positioning markers along a track.
- **Three degradation steps, because null dates are the normal case.**
  Extraction is deliberately conservative, so the component handles: a
  full start→end range (with a renewal marker and a "today" progress
  indicator when the contract is currently running); a partial result
  where only some dates were found, rendered as a plain labelled list
  rather than a bar implying a span that isn't known; and nothing found,
  rendered as an explanatory empty state that says *which* date formats
  are detectable rather than just showing a blank chart.
- **Local date parsing.** `new Date('2026-08-01')` parses as UTC
  midnight, which renders as 31 July in any timezone behind UTC — an
  off-by-one-day bug on a component whose entire job is displaying dates.
  `parseISODate()` splits the parts and uses the local constructor
  instead.

### 6. Search/filter across clauses — later addition, now built

The plan flags this as "nice-to-have — implement only if Phase 1–4 finish
early," which is exactly what happened: it was skipped in the initial
Phase 5 pass and added afterward once the rest of the plan's deliverables
were stable.

Scoped to within a single document, matching where the plan lists it
(Phase 5, item 3 — the summary view), rather than across documents or
across a user's whole history: a search box matches against both
`original_text` and the plain-language summary (case-insensitive
substring), and clause-type filter chips are generated from whatever
types actually appear in that document — a type with zero clauses
doesn't get a dead chip. Both combine with AND. Entirely client-side
(`components/ClauseFilters.tsx`); a document's clauses are already fully
loaded on the page, so this needed no new endpoint. The clause-type
chart is intentionally unaffected by the filter — it stays a whole-document
overview rather than re-deriving from a subset, so it doesn't imply the
distribution changed.

---

## Phase 7 polish, pulled forward

Phase 7 ("fix visual rough edges, not new features") was done early
rather than last, because screenshots for the Chapter 5 appendix and the
Phase 6 evaluation sessions both need a presentable UI, and both come
before Phase 7 in the schedule.

- Default `create-next-app` scaffolding replaced throughout; the app is
  branded "Clarity" with a custom SVG logo mark and Geist via
  `next/font`.
- A design-token system in `app/globals.css` (surface / border / muted /
  accent as CSS custom properties, switching on `prefers-color-scheme`),
  so light and dark are both deliberate rather than one being an
  afterthought.
- **Palette changed once, deliberately.** The first version used a
  blue-to-violet gradient, which reads as generic AI-generated styling.
  Replaced with warm "ink & amber" — stone neutrals plus a single deep
  amber accent, chosen partly because amber stays clear of the semantic
  clause colours (payment green, termination red, confidentiality blue),
  so the UI accent never competes with meaning.
- Scroll-reveal and entrance animations (`components/Reveal.tsx`, using
  `IntersectionObserver`), all disabled under
  `prefers-reduced-motion: reduce`.

---

## Framework-specific notes worth knowing

- **This project is on Next.js 16 / React 19**, which differs from most
  App Router material online. Notably `params` is a `Promise` and must be
  unwrapped with React's `use()` hook in client components — see
  `app/documents/[id]/page.tsx`.
- **Recharts 3 deprecates the `Cell` component** (removal planned for
  4.0). Per-bar colouring in `ClauseTypeChart` uses the `shape` prop with
  `Rectangle` instead, which is the documented replacement.
- **`lib/clause-types.ts` is the single source of truth** for clause
  labels, colours, and ordering. It exists because those maps were
  originally duplicated between the chart and the summary page and
  drifted apart — the chart was silently missing the `duration` category
  the backend added, so those bars rendered with a raw slug and fallback
  grey. Any new clause type should be added there and nowhere else.

---

## Verification

- `npx tsc --noEmit` — clean.
- `npm run build` — production build succeeds, all 7 routes.
- Delete flow verified live end-to-end against a throwaway account:
  `204` on delete, row removed, repeat delete correctly `404`s.
- Timeline verified live against a real tenancy contract: reprocessing it
  through `/process/` populated `start_date 2026-08-01` /
  `end_date 2027-07-31` / `renewal_date null`, and the component rendered
  the range with the null renewal correctly omitted.

## Known outstanding items

- **All Phase 5 deliverables are now built**, including the timeline that
  was previously blocked. The remaining caveat is a backend one, not a
  frontend gap: the timeline only shows dates that were confidently
  extracted, so contracts phrased in relative terms ("30 days after
  signing") legitimately render the "no dates detected" state.
- **4 ESLint errors, all `react-hooks/set-state-in-effect`**, in the
  dashboard, document detail, `Reveal`, and `auth-context`. They come
  from the React Compiler's performance rules and all point at the same
  pattern: fetch-on-mount inside `useEffect`, which is idiomatic for
  client-side authenticated fetching. They do not block the production
  build. Clearing them properly means adopting a data-fetching library
  (SWR or React Query) or moving fetches to Server Components — both
  larger refactors, better left until after the defense.