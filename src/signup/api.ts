/**
 * Client de l'API Kiess pour l'inscription du site : mêmes routes que l'app
 * (mobile/api.ts), donc une inscription faite ici est un compte de l'app.
 *
 *   POST /auth/request-otp, /auth/verify-otp   numéro + code SMS
 *   POST /auth/apple | google | facebook | discord   connexion sociale
 *   GET  /profiles/me                          profil (étape d'inscription)
 *   POST /uploads/photo, /uploads/photo/verify photo de profil
 *   POST /auth/complete-signup                 fin d'inscription
 *   POST /auth/refresh, /auth/logout
 *
 * Session : jetons gardés le temps de l'inscription dans sessionStorage
 * (onglet courant uniquement), puis révoqués et effacés à la fin.
 * Sans VITE_API_URL : mode démo, rien ne quitte le navigateur.
 */
import { CONFIG, type Provider } from '../config';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface Profile {
  firstName?: string;
  lastName?: string;
  username?: string;
  gender?: string;
  birthDate?: string;
  city?: string;
  photoUrl?: string;
  onboardingStage?: string;
}

export interface CompleteSignupInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  username: string;
  gender: string;
  birthDate: string;
  city: string;
  marketingOptIn: boolean;
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  photoUrl?: string;
}

/** status 0 = réseau / délai dépassé. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message = '',
  ) {
    super(message);
  }
}

const SESSION_KEY = 'kiess_signup_session';
const TIMEOUT_MS = 15_000;
export const DEMO = !CONFIG.apiUrl;

let tokens: Tokens | null = readSession();

function readSession(): Tokens | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Tokens>) : null;
    return parsed?.accessToken && parsed.refreshToken ? { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken } : null;
  } catch {
    return null;
  }
}

function setSession(next: Tokens | null) {
  tokens = next;
  try {
    if (next) sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Stockage indisponible : la session reste en mémoire.
  }
}

export const hasSession = () => !!tokens;

interface RequestInit {
  method?: 'GET' | 'POST';
  body?: unknown;
  auth?: boolean;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  if (init.auth) {
    if (!tokens) throw new ApiError(401);
    headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${CONFIG.apiUrl}${path}`, {
      method: init.method ?? 'POST',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: ctrl.signal,
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    throw new ApiError(0);
  } finally {
    window.clearTimeout(timer);
  }

  if (res.status === 401 && init.auth && retry && (await refresh())) {
    return request<T>(path, init, false);
  }
  const data = (await res.json().catch(() => null)) as { message?: unknown } | null;
  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(' ') : typeof data?.message === 'string' ? data.message : '';
    throw new ApiError(res.status, message);
  }
  return data as T;
}

async function refresh(): Promise<boolean> {
  if (!tokens) return false;
  try {
    setSession(await request<Tokens>('/auth/refresh', { body: { refreshToken: tokens.refreshToken } }, false));
    return true;
  } catch {
    setSession(null);
    return false;
  }
}

const keepTokens = (r: Tokens) => setSession({ accessToken: r.accessToken, refreshToken: r.refreshToken });

// ─── Mode démo ──────────────────────────────────────────────────────────────
const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
const DEMO_TOKENS: Tokens = { accessToken: 'demo', refreshToken: 'demo' };

// ─── Routes ─────────────────────────────────────────────────────────────────
export const api = {
  async requestOtp(phone: string): Promise<{ code?: string }> {
    if (DEMO) return wait(700).then(() => ({ code: '123456' }));
    return request('/auth/request-otp', { body: { channel: 'phone', value: phone } });
  },

  async verifyOtp(phone: string, code: string): Promise<void> {
    if (DEMO) return wait(700).then(() => keepTokens(DEMO_TOKENS));
    keepTokens(await request<Tokens>('/auth/verify-otp', { body: { value: phone, code } }));
  },

  /** token : id_token (Apple, Google), access token (Facebook) ou code (Discord). */
  async social(provider: Provider, token: string, redirectUri: string): Promise<void> {
    if (DEMO) return wait(700).then(() => keepTokens(DEMO_TOKENS));
    const route: Record<Provider, [string, unknown]> = {
      apple: ['/auth/apple', { idToken: token }],
      google: ['/auth/google', { idToken: token }],
      facebook: ['/auth/facebook', { accessToken: token }],
      discord: ['/auth/discord', { code: token, redirectUri }],
    };
    const [path, body] = route[provider];
    keepTokens(await request<Tokens>(path, { body }));
  },

  async getProfile(): Promise<Profile> {
    if (DEMO) return wait(300).then(() => ({ firstName: 'Prénom', onboardingStage: 'profile' }));
    return request('/profiles/me', { method: 'GET', auth: true });
  },

  /** Téléverse la photo (URL présignée) puis la fait vérifier (un seul visage). */
  async uploadPhoto(photo: Blob): Promise<{ fileUrl: string; approved: boolean; faceCount: number }> {
    if (DEMO) return wait(900).then(() => ({ fileUrl: 'demo', approved: true, faceCount: 1 }));
    const upload = await request<{ uploadUrl: string; fileUrl: string }>('/uploads/photo', {
      body: { size: photo.size },
      auth: true,
    });
    if (!upload.uploadUrl.startsWith('https://s3.mock/')) {
      let put: Response;
      try {
        put = await fetch(upload.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'image/jpeg' },
          body: photo,
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        });
      } catch {
        throw new ApiError(0);
      }
      if (!put.ok) throw new ApiError(put.status);
    }
    const verdict = await request<{ approved: boolean; faceCount: number }>('/uploads/photo/verify', {
      body: { fileUrl: upload.fileUrl },
      auth: true,
    });
    return { fileUrl: upload.fileUrl, ...verdict };
  },

  async completeSignup(input: CompleteSignupInput): Promise<Profile> {
    if (DEMO) return wait(900).then(() => ({ ...input, onboardingStage: 'complete' }));
    return request('/auth/complete-signup', { body: input, auth: true });
  },

  /** Fin de parcours : le site ne garde aucune session ouverte. */
  async endSession(): Promise<void> {
    const current = tokens;
    setSession(null);
    if (DEMO || !current) return;
    await request('/auth/logout', { body: { refreshToken: current.refreshToken } }).catch(() => undefined);
  },
};
