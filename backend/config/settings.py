"""
Django settings for the Legal Document Summarization System.

Maps directly to the architecture described in Chapter 3 (three-tier
architecture) and Chapter 4 (system specifications):
    - Django + Django REST Framework -> application layer
    - SimpleJWT                       -> Authentication Subsystem (4.3.1)
    - PostgreSQL                      -> data layer (4.4.1)
"""

import os
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------
# Core / security
# ---------------------------------------------------------------------
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'dev-only-change-me')
DEBUG = os.environ.get('DJANGO_DEBUG', 'True') == 'True'
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

# ---------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',

    # Local apps (Phase 1 onward)
    'documents',   # Document, Clause, Summary models
    'accounts',    # custom User-related extensions, EvaluationLog
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    # Serves static files in production. Without it the admin loads with no
    # CSS once DEBUG=False, since Django itself stops serving static then --
    # and the admin is where the evaluation results are read.
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# ---------------------------------------------------------------------
# Database (Chapter 4, Section 4.4.1 — PostgreSQL)
# ---------------------------------------------------------------------
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME', 'legal_summarizer'),
        'USER': os.environ.get('DB_USER', 'postgres'),
        'PASSWORD': os.environ.get('DB_PASSWORD', 'postgres'),
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}

# Managed hosts (Railway, Render, Heroku) inject a single DATABASE_URL
# rather than the discrete DB_* variables above. When present it wins, so
# the same settings file serves local development and deployment.
DATABASE_URL = os.environ.get('DATABASE_URL')
if DATABASE_URL:
    import dj_database_url

    DATABASES['default'] = dj_database_url.parse(
        DATABASE_URL, conn_max_age=600, ssl_require=False
    )

# ---------------------------------------------------------------------
# DRF + SimpleJWT (Chapter 4, Section 4.3.1 — Authentication Subsystem)
# ---------------------------------------------------------------------
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PARSER_CLASSES': (
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.MultiPartParser',  # required for file upload
    ),
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
}

# ---------------------------------------------------------------------
# CORS — allow the Next.js frontend (adjust port if different)
# ---------------------------------------------------------------------
def _parse_origins(raw: str) -> list[str]:
    """Splits a comma-separated origin list and guarantees each has a scheme.

    Both CORS_ALLOWED_ORIGINS and CSRF_TRUSTED_ORIGINS require a full
    origin ('https://example.com'), not a bare hostname — but pasting the
    bare domain from a hosting dashboard is the natural mistake, and the
    two settings punish it differently: django-cors-headers raises
    E013 and the container crash-loops, while Django's CSRF list just
    ignores the entry, so admin login fails later with an unrelated-looking
    CSRF error.

    A bare hostname is never valid in either setting, so adding the scheme
    is a correction rather than a guess. Local addresses get http://,
    everything else https://.
    """
    origins = []
    for candidate in raw.split(','):
        origin = candidate.strip().rstrip('/')
        if not origin:
            continue
        if '://' not in origin:
            local = origin.startswith(('localhost', '127.0.0.1', '[::1]'))
            origin = ('http://' if local else 'https://') + origin
        origins.append(origin)
    return origins


CORS_ALLOWED_ORIGINS = _parse_origins(
    os.environ.get('CORS_ALLOWED_ORIGINS', 'http://localhost:3000')
)

# ---------------------------------------------------------------------
# Deployment / HTTPS
# ---------------------------------------------------------------------
# Django 4+ requires the admin's origin to be trusted explicitly, or every
# admin login over HTTPS fails CSRF validation. Defaults to the frontend
# origins so a single env var usually covers both.
CSRF_TRUSTED_ORIGINS = _parse_origins(
    os.environ.get('CSRF_TRUSTED_ORIGINS', ','.join(CORS_ALLOWED_ORIGINS))
)

if not DEBUG:
    # Platform proxies terminate TLS and forward this header; without it
    # Django believes every request is plain HTTP and redirect-loops when
    # SECURE_SSL_REDIRECT is on.
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_SSL_REDIRECT = True
    # One year, the value HSTS preload requires. Only meaningful because
    # the platform serves this domain over HTTPS exclusively.
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# ---------------------------------------------------------------------
# File upload limits (Chapter 4, Section 4.4.5 — Input/Output Format)
# ---------------------------------------------------------------------
MAX_UPLOAD_SIZE_MB = int(os.environ.get('MAX_UPLOAD_SIZE_MB', 10))
DATA_UPLOAD_MAX_MEMORY_SIZE = MAX_UPLOAD_SIZE_MB * 1024 * 1024
ALLOWED_UPLOAD_EXTENSIONS = ['.pdf', '.docx']

# ---------------------------------------------------------------------
# Password validation
# ---------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ---------------------------------------------------------------------
# Internationalization
# ---------------------------------------------------------------------
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Africa/Lagos'
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------
# Static / media
# ---------------------------------------------------------------------
STATIC_URL = 'static/'
# collectstatic target. Required for any deploy — without STATIC_ROOT the
# build step fails outright.
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'
    },
}

MEDIA_URL = '/media/'
# Uploaded contracts. NOTE for deployment: on Railway (and most container
# hosts) this directory is ephemeral and is wiped on every restart or
# redeploy. That is tolerable here rather than a data-loss bug, because the
# pipeline reads the file exactly once at upload to extract its text — the
# extracted text, clauses and summaries all live in Postgres, so a
# processed document keeps working after its file disappears. Only
# re-downloading the original would break, which the UI never offers. Move
# to S3/Cloudinary if that ever changes.
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'