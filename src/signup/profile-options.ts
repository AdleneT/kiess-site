/**
 * Infos de la carte de profil demandées à l'inscription : secteur d'activité,
 * métier ou études, origines, origines recherchées et spiritualité.
 *
 * ⚠️ COPIE de mobile/profileOptions.ts (dépôt kiess-app/Kiess) : mêmes
 * identifiants que l'API (api/src/domain/profile-options.ts), mêmes libellés,
 * accordés au genre (« Chrétienne », « Amérindien ») et en forme inclusive
 * quand le genre ne le dit pas. Toute modification se fait d'abord dans l'app.
 */

export const UNDISCLOSED = 'non_dit';
export const UNDISCLOSED_LABEL = 'Ne préfère pas le dire';

/** Métier ou études : longueur maximale (même règle que l'API). */
export const OCCUPATION_MAX_LENGTH = 60;

type Form = 'm' | 'f' | 'x';
type Gendered = string | Readonly<Record<Form, string>>;

export type ProfileOption = { value: string; label: Gendered };

/** Secteurs d'activité, dans l'ordre affiché (« Études » en tête). */
export const SECTOR_OPTIONS: readonly ProfileOption[] = [
  { value: 'etudes', label: 'Études' },
  { value: 'sante', label: 'Santé & social' },
  { value: 'education', label: 'Éducation & recherche' },
  { value: 'tech', label: 'Tech & numérique' },
  { value: 'commerce', label: 'Commerce & vente' },
  { value: 'finance', label: 'Banque & assurance' },
  { value: 'droit', label: 'Droit & juridique' },
  { value: 'industrie', label: 'Ingénierie & industrie' },
  { value: 'btp', label: 'BTP & artisanat' },
  { value: 'culture', label: 'Art, culture & médias' },
  { value: 'communication', label: 'Communication & marketing' },
  { value: 'hotellerie', label: 'Hôtellerie & restauration' },
  { value: 'transport', label: 'Transport & logistique' },
  { value: 'public', label: 'Fonction publique & sécurité' },
  { value: 'agriculture', label: 'Agriculture & environnement' },
  { value: 'sport', label: 'Sport & bien-être' },
  { value: 'recherche_emploi', label: 'En recherche d’emploi' },
  { value: 'autre', label: 'Autre' },
  { value: UNDISCLOSED, label: UNDISCLOSED_LABEL },
];

/** Origines (plusieurs choix possibles). */
export const ORIGIN_OPTIONS: readonly ProfileOption[] = [
  { value: 'amerindien', label: { m: 'Amérindien', f: 'Amérindienne', x: 'Amérindien(ne)' } },
  { value: 'noir', label: { m: 'Noir (origine africaine)', f: 'Noire (origine africaine)', x: 'Noir(e) (origine africaine)' } },
  { value: 'asie_est', label: 'Asiatique de l’Est' },
  { value: 'moyen_orient', label: 'Moyen-Orient' },
  { value: 'maghreb', label: 'Maghreb' },
  { value: 'pacifique', label: 'Insulaire du Pacifique' },
  { value: 'asie_sud', label: 'Asiatique du Sud' },
  { value: 'asie_sud_est', label: 'Asiatique du Sud-Est' },
  { value: 'blanc', label: { m: 'Blanc / Caucasien', f: 'Blanche / Caucasienne', x: 'Blanc(he) / Caucasien(ne)' } },
  { value: 'autre', label: 'Autre' },
  { value: UNDISCLOSED, label: UNDISCLOSED_LABEL },
];

/** Origines recherchées : « Peu importe » (liste vide pour l'API) ou une sélection. */
export const ANY_ORIGIN = 'peu_importe';
export const SOUGHT_ORIGIN_OPTIONS: readonly ProfileOption[] = [
  { value: ANY_ORIGIN, label: 'Peu importe' },
  ...ORIGIN_OPTIONS.filter((o) => o.value !== UNDISCLOSED),
];

/** Spiritualité (un seul choix). */
export const SPIRITUALITY_OPTIONS: readonly ProfileOption[] = [
  { value: 'agnostique', label: 'Agnostique' },
  { value: 'athee', label: 'Athée' },
  { value: 'bouddhiste', label: 'Bouddhiste' },
  { value: 'catholique', label: 'Catholique' },
  { value: 'chretien', label: { m: 'Chrétien', f: 'Chrétienne', x: 'Chrétien(ne)' } },
  { value: 'hindou', label: { m: 'Hindou', f: 'Hindoue', x: 'Hindou(e)' } },
  { value: 'juif', label: { m: 'Juif', f: 'Juive', x: 'Juif(ve)' } },
  { value: 'musulman', label: { m: 'Musulman', f: 'Musulmane', x: 'Musulman(e)' } },
  { value: 'sikh', label: 'Sikh' },
  { value: 'autre', label: 'Autre' },
  { value: UNDISCLOSED, label: UNDISCLOSED_LABEL },
];

/** Forme du libellé selon le genre (« un homme », « une femme », sinon inclusive). */
export function genderForm(gender?: string | null): Form {
  const g = gender?.trim().toLowerCase();
  if (g === 'un homme') return 'm';
  if (g === 'une femme') return 'f';
  return 'x';
}

export function optionLabel(option: ProfileOption, gender?: string | null): string {
  return typeof option.label === 'string' ? option.label : option.label[genderForm(gender)];
}

const has = (options: readonly ProfileOption[], value: string | null | undefined) => !!value && options.some((o) => o.value === value);
export const isSector = (v?: string | null) => has(SECTOR_OPTIONS, v);
export const isOrigin = (v?: string | null) => has(ORIGIN_OPTIONS, v);
export const isSpirituality = (v?: string | null) => has(SPIRITUALITY_OPTIONS, v);

/**
 * Sélection multiple avec valeurs exclusives (« Ne préfère pas le dire »,
 * « Peu importe ») : en choisir une la laisse seule, choisir une autre valeur
 * retire les exclusives. Toucher une valeur choisie la retire.
 */
export function toggleChoice(current: readonly string[], value: string, exclusive: readonly string[]): string[] {
  if (current.includes(value)) return current.filter((v) => v !== value);
  if (exclusive.includes(value)) return [value];
  return [...current.filter((v) => !exclusive.includes(v)), value];
}
