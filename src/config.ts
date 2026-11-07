/** Réglages du site, lus au build depuis les variables VITE_* (voir .env.example). */
const env = import.meta.env;

const read = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export type Provider = 'apple' | 'google' | 'facebook' | 'discord';

export const CONFIG = {
  /**
   * Adresse de l'API Kiess, sans / final : la même que l'app
   * (EXPO_PUBLIC_API_URL). L'inscription du site crée un compte de l'app.
   * Vide : mode démo (rien n'est envoyé).
   */
  apiUrl: read(env.VITE_API_URL).replace(/\/+$/, ''),
  supportEmail: 'support@kiess.fr',
  /**
   * Identifiants publics des connexions sociales, côté « application web »
   * (aucun secret ici : le secret Discord reste sur l'API).
   * Vide : le bouton est masqué en production ; en développement, il passe
   * par les jetons de test de l'API (dev_token_…), comme l'app en Expo Go.
   */
  oauth: {
    apple: read(env.VITE_APPLE_SERVICES_ID),
    google: read(env.VITE_GOOGLE_CLIENT_ID),
    facebook: read(env.VITE_FACEBOOK_APP_ID),
    discord: read(env.VITE_DISCORD_CLIENT_ID),
  } satisfies Record<Provider, string>,
};
