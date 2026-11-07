/** Réglages du site, surchargés par les variables VITE_* (voir .env.example). */
const env = import.meta.env;

const read = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** Adresse de l'API Kiess (même valeur que EXPO_PUBLIC_API_URL du mobile). */
const apiUrl = read(env.VITE_API_URL).replace(/\/+$/, '');
const fromApi = (path: string) => (apiUrl ? `${apiUrl}${path}` : '');

export const CONFIG = {
  /** POST /pre-registrations de l'API (api/src/pre-registrations). Vide = mode démo. */
  betaEndpoint: read(env.VITE_BETA_ENDPOINT) || fromApi('/pre-registrations'),
  cguUrl: read(env.VITE_CGU_URL) || fromApi('/legal/cgu') || 'https://kiess-api.onrender.com/legal/cgu',
  privacyUrl: read(env.VITE_PRIVACY_URL) || fromApi('/legal/privacy') || 'https://kiess-api.onrender.com/legal/privacy',
  supportEmail: 'support@kiess.fr',
} as const;
