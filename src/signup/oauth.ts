/**
 * Connexion sociale du site, sans script tiers (la CSP reste « 'self' ») :
 * la page part chez le fournisseur puis revient sur le site avec, selon le
 * fournisseur, un id_token (Apple, Google), un jeton d'accès (Facebook) ou
 * un code (Discord, échangé par l'API avec son secret).
 *
 * Protection : `state` aléatoire (anti-CSRF) et `nonce` (Apple, Google)
 * vérifiés au retour ; la réponse est retirée de l'adresse aussitôt lue.
 *
 * Adresse de retour à déclarer chez chaque fournisseur : l'accueil du site,
 * ex. https://kiess.fr/ (et http://localhost:5173/ en développement).
 */
import { CONFIG, type Provider } from '../config';

const PENDING_KEY = 'kiess_oauth_pending';
const MAX_AGE_MS = 15 * 60 * 1000;

export const PROVIDER_LABELS: Record<Provider, string> = {
  apple: 'Apple',
  google: 'Google',
  facebook: 'Facebook',
  discord: 'Discord',
};

export const redirectUri = () => `${window.location.origin}/`;

interface Pending {
  provider: Provider;
  state: string;
  nonce: string;
  at: number;
}

export type OAuthReturn =
  | { ok: true; provider: Provider; token: string; email?: string }
  | { ok: false; provider?: Provider; reason: 'cancelled' | 'failed' };

function random(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Fournisseur configuré pour ce build (ou mode test de l'API en développement). */
export function isAvailable(provider: Provider): boolean {
  return !!CONFIG.oauth[provider] || import.meta.env.DEV;
}

/** Sans identifiant en développement : jeton de test accepté par l'API hors production. */
export function usesDevToken(provider: Provider): boolean {
  return !CONFIG.oauth[provider];
}

export function devToken(provider: Provider): string {
  return `dev_token_${provider}_${random().slice(0, 12)}`;
}

function authorizeUrl(provider: Provider, state: string, nonce: string): string {
  const id = CONFIG.oauth[provider];
  const redirect = redirectUri();
  const build = (base: string, params: Record<string, string>) => `${base}?${new URLSearchParams(params).toString()}`;
  switch (provider) {
    case 'google':
      return build('https://accounts.google.com/o/oauth2/v2/auth', {
        client_id: id,
        redirect_uri: redirect,
        response_type: 'id_token',
        scope: 'openid email profile',
        nonce,
        state,
        prompt: 'select_account',
      });
    case 'apple':
      // Sans « scope » : réponse dans le fragment (form_post n'est obligatoire
      // que pour demander nom et e-mail, saisis ensuite dans le parcours).
      return build('https://appleid.apple.com/auth/authorize', {
        client_id: id,
        redirect_uri: redirect,
        response_type: 'code id_token',
        response_mode: 'fragment',
        nonce,
        state,
      });
    case 'facebook':
      return build('https://www.facebook.com/v18.0/dialog/oauth', {
        client_id: id,
        redirect_uri: redirect,
        response_type: 'token',
        scope: 'email,public_profile',
        state,
      });
    case 'discord':
      return build('https://discord.com/oauth2/authorize', {
        client_id: id,
        redirect_uri: redirect,
        response_type: 'code',
        scope: 'identify email',
        state,
      });
  }
}

/** Part chez le fournisseur (navigation de la page entière). */
export function startOAuth(provider: Provider): void {
  const pending: Pending = { provider, state: random(), nonce: random(), at: Date.now() };
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  window.location.assign(authorizeUrl(provider, pending.state, pending.nonce));
}

function readPending(): Pending | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as Pending) : null;
  } catch {
    return null;
  }
}

/** Charge utile d'un JWT (sans vérification : l'API vérifie la signature). */
function jwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      Array.from(atob(part), (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * À appeler au chargement, avant tout traitement de l'adresse : lit le retour
 * du fournisseur s'il y en a un, nettoie l'adresse et renvoie le résultat.
 */
export function consumeOAuthReturn(): OAuthReturn | null {
  const pending = readPending();
  if (!pending) return null;

  const hash = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  const params = hash.has('state') ? hash : query.has('state') ? query : null;
  if (!params) {
    if (Date.now() - pending.at > MAX_AGE_MS) sessionStorage.removeItem(PENDING_KEY);
    return null;
  }

  sessionStorage.removeItem(PENDING_KEY);
  window.history.replaceState(null, '', window.location.pathname);

  const { provider } = pending;
  if (params.get('state') !== pending.state || Date.now() - pending.at > MAX_AGE_MS) {
    return { ok: false, provider, reason: 'failed' };
  }
  const error = params.get('error');
  if (error) {
    const cancelled = /denied|cancel|user_cancelled_authorize|popup_closed/i.test(`${error} ${params.get('error_reason') ?? ''}`);
    return { ok: false, provider, reason: cancelled ? 'cancelled' : 'failed' };
  }

  if (provider === 'google' || provider === 'apple') {
    const idToken = params.get('id_token') ?? '';
    const claims = jwtPayload(idToken);
    if (!claims || claims.nonce !== pending.nonce) return { ok: false, provider, reason: 'failed' };
    const email = provider === 'google' && claims.email_verified === true && typeof claims.email === 'string' ? claims.email : undefined;
    return { ok: true, provider, token: idToken, email };
  }
  const token = provider === 'facebook' ? params.get('access_token') : params.get('code');
  return token ? { ok: true, provider, token } : { ok: false, provider, reason: 'failed' };
}
