/**
 * Envoi de la préinscription — SEUL point de contact avec le backend.
 *
 * ─── Contrat avec le serveur ──────────────────────────────────────────────
 * POST {CONFIG.betaEndpoint} (voir config.ts), en JSON, vers :
 *   - par défaut : /api/preinscription.php (public/api, base MySQL Hostinger) ;
 *   - si VITE_API_URL : {API}/pre-registrations (api/src/pre-registrations).
 * Corps : `BetaPreregistration` (ci-dessous). Les deux serveurs refusent toute
 * clé inconnue : garder ce type, le script PHP et CreatePreRegistrationDto alignés.
 *
 * Réponses :
 *   201 / 200  → succès, écran « Demande envoyée » (le PHP répond aussi 201
 *                pour une adresse déjà inscrite : il ne révèle pas qui est inscrit)
 *   409        → e-mail déjà inscrit (API Nest)
 *   422 / 400  → données refusées ; le `message` du corps est affiché tel quel
 *                (l'API renvoie les mêmes textes que la validation du site)
 *   429        → trop de tentatives (5 envois par minute et par IP)
 *   autre      → message d'erreur générique
 *
 * Côté serveur : revalidation complète (âge ≥ 18 compris), mot de passe hashé
 * en argon2id, pot de miel `website` ignoré silencieusement (réponse 201),
 * statut de sélection pending / selected / rejected / invited.
 *
 * Valeurs alignées sur l'API Kiess :
 *   gender      → mêmes libellés que l'onboarding mobile (GenderStep.tsx)
 *   preferences → genres normalisés de matching/compatibility.ts ;
 *                 tableau vide = ouvert à tout le monde
 *   birthDate   → AAAA-MM-JJ
 * ──────────────────────────────────────────────────────────────────────────
 */
import { CONFIG } from '../config';

export type Gender = 'un homme' | 'une femme' | 'non binaire' | 'autres';
export type Preference = 'homme' | 'femme' | 'nb';

export interface BetaPreregistration {
  email: string;
  password: string;
  gender: Gender;
  /** [] = « Tout le monde » */
  preferences: Preference[];
  /** AAAA-MM-JJ, 18 ans minimum (vérifié côté client, à revérifier côté serveur) */
  birthDate: string;
  acceptedTerms: true;
  marketingOptIn: boolean;
  /** Pot de miel : toujours vide pour un humain */
  website: string;
  /** Contexte d'acquisition (utm_source, etc.), facultatif */
  source?: Record<string, string>;
  /** Horodatage client ISO, informatif */
  submittedAt: string;
}

export type SubmitResult =
  | { ok: true; demo: boolean }
  | { ok: false; error: string };

const GENERIC_ERROR = 'Impossible d’envoyer ta demande pour le moment. Réessaie dans quelques instants.';

export async function submitPreregistration(payload: BetaPreregistration): Promise<SubmitResult> {
  if (!CONFIG.betaEndpoint) {
    // Mode démo : aucun backend branché. On simule un aller-retour réseau.
    // Le mot de passe n'est jamais affiché ni stocké.
    const { password: _omit, ...safe } = payload;
    console.info('[Kiess] Mode démo (VITE_API_URL vide). Données qui seraient envoyées :', safe);
    await new Promise((r) => setTimeout(r, 1100));
    return { ok: true, demo: true };
  }

  try {
    const res = await fetch(CONFIG.betaEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true, demo: false };
    if (res.status === 409) return { ok: false, error: 'Cette adresse mail est déjà préinscrite.' };
    if (res.status === 429) return { ok: false, error: 'Trop de tentatives. Patiente quelques minutes avant de réessayer.' };
    if (res.status === 400 || res.status === 422) {
      const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
      const msg = Array.isArray(body?.message) ? body?.message.join(' ') : body?.message;
      return { ok: false, error: typeof msg === 'string' && msg ? msg : 'Certaines informations ne sont pas valides.' };
    }
    return { ok: false, error: GENERIC_ERROR };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

/** Récupère les paramètres utm_* de l'URL pour `source`. */
export function readSource(): Record<string, string> | undefined {
  const params = new URLSearchParams(window.location.search);
  const out: Record<string, string> = {};
  params.forEach((v, k) => {
    if (k.startsWith('utm_') || k === 'ref') out[k] = v.slice(0, 120);
  });
  return Object.keys(out).length ? out : undefined;
}
