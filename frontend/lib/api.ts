/**
 * Thin client for the Django + DRF + SimpleJWT backend. No fetch library —
 * the API surface is small enough that a couple of wrapper functions cover
 * it (register/login/refresh, upload, process, list, detail).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface Tokens {
  access: string;
  refresh: string;
}

const ACCESS_KEY = 'lds_access';
const REFRESH_KEY = 'lds_refresh';
const USERNAME_KEY = 'lds_username';

export function getStoredSession(): (Tokens & { username: string | null }) | null {
  if (typeof window === 'undefined') return null;
  const access = localStorage.getItem(ACCESS_KEY);
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!access || !refresh) return null;
  return { access, refresh, username: localStorage.getItem(USERNAME_KEY) };
}

export function storeSession(tokens: Tokens, username: string) {
  localStorage.setItem(ACCESS_KEY, tokens.access);
  localStorage.setItem(REFRESH_KEY, tokens.refresh);
  localStorage.setItem(USERNAME_KEY, username);
}

export function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USERNAME_KEY);
}

/** Decodes a JWT payload without verifying the signature — fine here since
 * it's only used to read our own token's exp claim for refresh scheduling,
 * never for trusting unverified claims. */
export function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function getTokenExpiryMs(token: string): number | null {
  const payload = decodeJwtPayload<{ exp?: number }>(token);
  return payload?.exp ? payload.exp * 1000 : null;
}

function firstErrorMessage(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (typeof obj.error === 'string') return obj.error;
    if (typeof obj.detail === 'string') return obj.detail;
    const firstKey = Object.keys(obj)[0];
    if (firstKey) {
      const val = obj[firstKey];
      return Array.isArray(val) ? String(val[0]) : String(val);
    }
  }
  return 'Something went wrong. Please try again.';
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export async function register(username: string, email: string, password: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/auth/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });
  if (!res.ok) throw new ApiError(firstErrorMessage(await parseJsonSafe(res)), res.status);
}

export async function login(username: string, password: string): Promise<Tokens> {
  const res = await fetch(`${API_URL}/api/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new ApiError('Incorrect username or password.', res.status);
  const { access, refresh } = data as Tokens;
  return { access, refresh };
}

export async function refreshAccessToken(refresh: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) throw new ApiError('Session expired. Please log in again.', res.status);
  const data = (await parseJsonSafe(res)) as { access: string };
  return data.access;
}

export interface DocumentSummary {
  id: number;
  file_name: string;
  file_type: string;
  upload_date: string;
  status: 'uploaded' | 'processing' | 'complete' | 'failed';
}

export interface ClauseSummary {
  id: number;
  summary_text: string;
  generated_at: string;
}

export interface Clause {
  id: number;
  // 'duration' was missing here for the same reason it was missing from the
  // backend's ClauseType choices: the classifier started emitting it and
  // this list was never updated. Nothing broke visibly because the label
  // and colour helpers both fall back, but the type was lying.
  clause_type:
    | 'payment'
    | 'termination'
    | 'confidentiality'
    | 'renewal'
    | 'duration'
    | 'other';
  original_text: string;
  position: number;
  summary: ClauseSummary | null;
}

export interface DocumentDetail extends DocumentSummary {
  /** Derived contract dates, ISO "YYYY-MM-DD". Null whenever extraction
   * couldn't confidently find one — which is common, since plenty of
   * contracts don't state dates in a machine-parseable way. Never render
   * these without handling null. */
  start_date: string | null;
  end_date: string | null;
  renewal_date: string | null;
  clauses: Clause[];
}

async function authedRequest<T>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    throw new ApiError(firstErrorMessage(await parseJsonSafe(res)), res.status);
  }
  return (await parseJsonSafe(res)) as T;
}

export function listDocuments(accessToken: string): Promise<DocumentSummary[]> {
  return authedRequest('/api/documents/', accessToken);
}

export function getDocument(id: string | number, accessToken: string): Promise<DocumentDetail> {
  return authedRequest(`/api/documents/${id}/summary/`, accessToken);
}

export async function uploadDocument(file: File, accessToken: string): Promise<DocumentSummary> {
  const formData = new FormData();
  formData.append('file', file);
  return authedRequest('/api/documents/upload/', accessToken, {
    method: 'POST',
    body: formData,
  });
}

export function processDocument(id: string | number, accessToken: string): Promise<DocumentDetail> {
  return authedRequest(`/api/documents/${id}/process/`, accessToken, { method: 'POST' });
}

export async function deleteDocument(id: string | number, accessToken: string): Promise<void> {
  // Returns 204 No Content, so there's no body to parse — authedRequest's
  // parse would just yield {}, but calling fetch directly keeps that explicit.
  const res = await fetch(`${API_URL}/api/documents/${id}/`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new ApiError(firstErrorMessage(await parseJsonSafe(res)), res.status);
  }
}

/**
 * Evaluation logs — the usability/comprehension ratings Chapter 5's
 * evaluation is built from. The backend enforces one per user per
 * document and upserts on repeat submission, so re-rating updates the
 * existing row rather than adding a second one.
 */
export interface EvaluationLog {
  id: number;
  document: number;
  rating: number;
  comments: string;
  created_at: string;
}

export function listEvaluations(accessToken: string): Promise<EvaluationLog[]> {
  return authedRequest('/api/evaluation-logs/', accessToken);
}

export function submitEvaluation(
  documentId: number,
  rating: number,
  comments: string,
  accessToken: string
): Promise<EvaluationLog> {
  return authedRequest('/api/evaluation-logs/', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document: documentId, rating, comments }),
  });
}
