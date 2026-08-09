# Deployment Guide — Railway + Vercel

**Railway** hosts the Django API and PostgreSQL. **Vercel** hosts the
Next.js frontend. Both have free tiers sufficient for a project demo.

The repo has already been prepared for this — see §6 for exactly what
changed and why, including two issues that would have failed a deploy
outright.

---

## 0. Read this first: the ML dependency decision

The original `requirements.txt` pinned `torch` (**1.0 GB installed**) and
`transformers`, and the pipeline downloaded a **1.2 GB model** on first
use. Deployed as-is that means:

- an image far past Railway's comfortable build size,
- a 1.2 GB download on **every cold start**, because container
  filesystems are ephemeral and the model cache never survives a restart,
- the first `/process/` request after any restart timing out while it
  downloads.

The neural model was already only a *secondary* path — it runs on clauses
over 130 words (2 of 63 in the real corpus, ~3%) and its output is
discarded unless it beats a near-copy check, which it usually doesn't.

**So the deployed build omits it.** `transformers` is now imported lazily
inside `get_summarizer()`, which returns `None` if the package is absent,
and `summarize_text()` falls back to the extractive + rule-based path —
the primary path regardless. Verified: with `transformers` and `torch`
forced to fail on import, a 132-word clause still summarises to 65 words.

To run *with* the model locally:

```bash
pip install -r requirements.txt -r requirements-ml.txt
```

Nothing in the UI changes either way. Worth one sentence in Chapter 5:
the deployed configuration runs the deterministic pipeline only.

---

## 1. Push to GitHub

Both platforms deploy from a repo. From the project root:

```bash
git add -A
git commit -m "Prepare for deployment"
git push
```

Confirm `backend/venv/`, `frontend/node_modules/`, `.env`, and
`backend/media/` are git-ignored before pushing — `venv` alone is over a
gigabyte and will make the push crawl.

---

## 2. Railway — database

1. Sign in at [railway.app](https://railway.app) with GitHub.
2. **New Project → Provision PostgreSQL**.
3. Leave it; Railway exposes `DATABASE_URL` automatically and the settings
   file already prefers it over the discrete `DB_*` variables.

## 3. Railway — Django API

1. In the same project: **New → GitHub Repo →** select this repo.
2. **Settings → Root Directory:** `backend`
   (critical — otherwise Railway tries to build the Next.js app too).
3. **Settings → Start Command:**
   ```
   python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 120
   ```
   (Also in `backend/Procfile`; set it explicitly if Railway doesn't pick
   it up.)
4. **Variables** — add:

   | Variable | Value |
   |---|---|
   | `DJANGO_SECRET_KEY` | a fresh 64-char random string (see below) |
   | `DJANGO_DEBUG` | `False` |
   | `DJANGO_ALLOWED_HOSTS` | `<your-app>.up.railway.app` |
   | `CORS_ALLOWED_ORIGINS` | `https://<your-app>.vercel.app` |
   | `CSRF_TRUSTED_ORIGINS` | `https://<your-app>.up.railway.app,https://<your-app>.vercel.app` |
   | `DATABASE_URL` | reference the Postgres service's variable |
   | `MAX_UPLOAD_SIZE_MB` | `10` |

   Generate the secret key:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(64))"
   ```

   `DATABASE_URL` should be a **reference** to the Postgres service, not a
   pasted string — Railway's variable picker does this, and it keeps
   working if credentials rotate.

5. **Networking → Generate Domain.** Note the URL.
6. Deploy. Watch the build log: it installs `requirements.txt` (including
   the spaCy model, pinned as a real dependency so it can't be forgotten),
   runs migrations, then starts gunicorn.

### Create your admin user

Once deployed, open the service's shell (Railway → your service →
**Shell**) and run:

```bash
python manage.py createsuperuser
```

Then log in at `https://<your-app>.up.railway.app/admin/` — this is where
the evaluation results are read (see `EVALUATION_FEATURE.md`).

`collectstatic` runs automatically on Railway's Python builder; if the
admin appears unstyled, run `python manage.py collectstatic --noinput` in
the shell once.

---

## 4. Vercel — Next.js frontend

1. Sign in at [vercel.com](https://vercel.com) with GitHub, **Add New →
   Project**, import the repo.
2. **Root Directory:** `frontend`
3. Framework preset: **Next.js** (auto-detected). Leave build settings
   alone.
4. **Environment Variables:**

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://<your-app>.up.railway.app` |

   No trailing slash — the API client concatenates paths directly.

   It must be `NEXT_PUBLIC_`-prefixed: the value is read in the browser,
   and Next.js replaces any non-prefixed variable with an empty string in
   client code.

5. Deploy.

## 5. Close the loop

The two services reference each other, so one value on each side can only
be filled in after the other exists:

1. Deploy Railway → get the API URL.
2. Set `NEXT_PUBLIC_API_URL` on Vercel → deploy → get the frontend URL.
3. Go back to Railway and set `CORS_ALLOWED_ORIGINS` and
   `CSRF_TRUSTED_ORIGINS` to the real Vercel URL → redeploy.

Skipping step 3 is the most common failure: the site loads, but every API
call fails CORS and login appears broken for no visible reason.

### Smoke test

```bash
# Should be 401, not a connection error — proves the API is up and
# authentication is enforced.
curl -i https://<your-app>.up.railway.app/api/documents/
```

Then in the browser: register → upload a contract → confirm summaries,
the clause chart and the timeline render → submit a rating → check it
appears in `/admin/accounts/evaluationlog/`.

---

## 6. What was changed to make this deployable

Two of these were **hard blockers** — the deploy would have failed or the
app would have crashed on boot.

| Change | Why |
|---|---|
| **Added `python-dateutil` to `requirements.txt`** | **Blocker.** `date_extractor.py` imports it, but it was never added after being installed locally. Every request would have 500'd on import in production. |
| **Added `STATIC_ROOT`** | **Blocker.** `collectstatic` fails without it, so the build breaks. |
| **Added WhiteNoise** | With `DEBUG=False` Django stops serving static files, so the admin would load with no CSS — and the admin is where evaluation data is read. |
| **`transformers` import made lazy + optional** | Sheds ~1.1 GB of dependencies and a 1.2 GB per-cold-start download. See §0. |
| **spaCy model pinned as a dependency** | It was a comment saying "run `python -m spacy download`". A build that skips it starts up and then fails at the first upload. |
| **`DATABASE_URL` support (`dj-database-url`)** | Railway injects one URL, not discrete `DB_*` variables. Local `DB_*` config still works when it's absent. |
| **`CSRF_TRUSTED_ORIGINS`** | Django 4+ rejects admin logins over HTTPS without it. |
| **`SECURE_PROXY_SSL_HEADER` + HSTS + SSL redirect** | Behind a TLS-terminating proxy Django otherwise thinks every request is HTTP and redirect-loops. Applied only when `DEBUG=False`. |
| **`Procfile`** | Runs migrations then gunicorn, so a deploy can't serve against an un-migrated database. |
| **`requirements-ml.txt`** | Keeps the optional model path installable locally without putting it in the deployed image. |

Verified after these changes: **35/35 tests pass**,
`manage.py check --deploy` reports **no issues** with `DEBUG=False` and a
real secret key, and the pipeline produces correct summaries with
`transformers`/`torch` unavailable.

---

## 7. Known limitations of this deployment

State these in Chapter 5 rather than leaving them to be discovered.

**Uploaded files are ephemeral.** Railway wipes the container filesystem
on every restart and redeploy, so `MEDIA_ROOT` does not persist. This is
tolerable rather than a data-loss bug: the pipeline reads each file
exactly once at upload to extract its text, and the extracted text,
clauses, summaries and dates all live in Postgres. A processed document
keeps working after its original file disappears; only re-downloading the
source would break, which the interface never offers. Persisting them
means adding S3 or Cloudinary storage.

**Processing is synchronous.** `/process/` runs the whole NLP pipeline
inside the request, taking a few seconds per document. Fine at demo
scale; a production system would move it to a task queue (Celery + Redis)
and poll for completion. The gunicorn timeout is set to 120s to
accommodate it.

**Cold starts.** Free-tier Railway services sleep when idle, so the first
request after a quiet period takes a few seconds while spaCy loads. Hit
the site once before demoing.

**Free-tier Postgres is small.** Ample for evaluation, not for volume.

---

## 8. If something breaks

| Symptom | Cause |
|---|---|
| `DisallowedHost` | `DJANGO_ALLOWED_HOSTS` missing the Railway domain |
| Login works locally, fails deployed | `CORS_ALLOWED_ORIGINS` not set to the real Vercel URL (step 5.3) |
| Admin login "CSRF verification failed" | `CSRF_TRUSTED_ORIGINS` missing the Railway domain, scheme included |
| Admin renders unstyled | `collectstatic` didn't run — run it in the Railway shell |
| Frontend calls `localhost:8000` | `NEXT_PUBLIC_API_URL` unset at **build** time; set it and redeploy (Next.js inlines it at build, not runtime) |
| Upload 500s | Check the log for `ModuleNotFoundError` — most likely a dependency in the local venv that never made it into `requirements.txt` |
| Infinite redirect loop | `SECURE_SSL_REDIRECT` without the proxy header; already handled, but check any custom proxy |
