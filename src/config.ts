/** Réglages du site, surchargés par les variables VITE_* (voir .env.example). */
const env = import.meta.env;

const read = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** Adresse de l'API Kiess (même valeur que EXPO_PUBLIC_API_URL du mobile), si elle est en ligne. */
const apiUrl = read(env.VITE_API_URL).replace(/\/+$/, '');

/**
 * Où part le formulaire de préinscription, par ordre de priorité :
 *   1. VITE_BETA_ENDPOINT (URL complète) ;
 *   2. VITE_API_URL → {API}/pre-registrations (module api/src/pre-registrations) ;
 *   3. en production : le script PHP livré avec le site (public/api/preinscription.php),
 *      qui enregistre dans la base MySQL de l'hébergement Hostinger.
 * En développement (npm run dev), sans 1 ni 2 : mode démo, rien n'est envoyé.
 */
const betaEndpoint =
  read(env.VITE_BETA_ENDPOINT) ||
  (apiUrl ? `${apiUrl}/pre-registrations` : '') ||
  (env.PROD ? '/api/preinscription.php' : '');

export const CONFIG = {
  betaEndpoint,
  supportEmail: 'support@kiess.fr',
} as const;
