/**
 * Questionnaire du profil, comme dans l'app : copie de mobile/questionnaire.ts
 * (kiess-app/Kiess), sans ce qui est propre à React Native. Garder les deux
 * fichiers alignés.
 *
 * Posé à l'inscription après la date de naissance ; obligatoire avant le
 * premier matchmaking (l'app le redemande sinon). Identifiants partagés avec
 * l'API (api/src/profiles/questionnaire.ts). Ce qui est recherché accepte
 * plusieurs réponses, et une liste vide veut dire « Peu importe ». Le style
 * accepte aussi plusieurs réponses (sans le dire à l'écran). La pilosité
 * n'est pas demandée aux femmes (questionsFor).
 */

export type Questionnaire = {
  silhouette?: string;
  hairColor?: string;
  hairLength?: string;
  eyes?: string;
  /** Un style ou plusieurs (une seule chaîne avant le 25/11/2026 : answersOf la lit comme une liste). */
  style?: string[];
  pilosity?: string;
  seekHeights?: string[];
  seekSilhouettes?: string[];
  seekHairColors?: string[];
  seekEyes?: string[];
  seekStyles?: string[];
  values?: string[];
  seekValues?: string[];
};

export type QuestionKey = keyof Questionnaire;
export type SingleKey = 'silhouette' | 'hairColor' | 'hairLength' | 'eyes' | 'pilosity';
export type GenderKind = 'm' | 'f' | 'x';
export type MultiKey = Exclude<QuestionKey, SingleKey>;

/** Libellé accordé : masculin, féminin, forme inclusive (genre inconnu ou personne recherchée). */
type Label = string | { m: string; f: string; x: string };

export type QuestionOption = { value: string; label: Label };

export type QuestionSection = 'me' | 'seek' | 'values';

export type Question = {
  key: QuestionKey;
  section: QuestionSection;
  /** Intitulé à l'inscription (« Ta silhouette »). */
  title: string;
  /** Intitulé court sur la carte et dans le récapitulatif (« Silhouette »). */
  short: string;
  /** Intitulé court sur son propre profil, quand il diffère (« Mes valeurs »). */
  shortMine?: string;
  hint?: string;
  options: readonly QuestionOption[];
  multi: boolean;
  /** Plafond de réponses (valeurs : 3). */
  max?: number;
  /** Une réponse au moins (questions du physique, tes valeurs). */
  required: boolean;
  /** Liste vide acceptée et montrée comme « Peu importe » (ce qui est recherché). */
  anyLabel?: string;
  /** Question pas posée pour ce genre (la pilosité aux femmes). */
  notFor?: GenderKind;
  /** Plusieurs réponses possibles sans le montrer (pas d'aide, ronds au lieu de cases). */
  quietMulti?: boolean;
};

export const ANY = 'Peu importe';

const SILHOUETTES: QuestionOption[] = [
  { value: 'mince', label: 'Mince' },
  { value: 'elancee', label: { m: 'Élancé', f: 'Élancée', x: 'Élancé·e' } },
  { value: 'athletique', label: 'Athlétique' },
  { value: 'musclee', label: { m: 'Musclé', f: 'Musclée', x: 'Musclé·e' } },
  { value: 'moyenne', label: 'Dans la moyenne' },
  { value: 'courbes', label: 'Avec des formes' },
  { value: 'ronde', label: { m: 'Rond', f: 'Ronde', x: 'Rond·e' } },
  { value: 'carrure', label: 'Carrure imposante' },
];

const HAIR_COLORS: QuestionOption[] = [
  { value: 'blonds', label: 'Blonds' },
  { value: 'chatains', label: 'Châtains' },
  { value: 'bruns', label: 'Bruns' },
  { value: 'noirs', label: 'Noirs' },
  { value: 'roux', label: 'Roux' },
  { value: 'gris', label: 'Gris ou blancs' },
  { value: 'colores', label: 'Colorés' },
  { value: 'sans', label: 'Pas de cheveux' },
];

const HAIR_LENGTHS: QuestionOption[] = [
  { value: 'rases', label: 'Rasés' },
  { value: 'courts', label: 'Courts' },
  { value: 'mi_longs', label: 'Mi-longs' },
  { value: 'longs', label: 'Longs' },
];

const EYES: QuestionOption[] = [
  { value: 'bleus', label: 'Bleus' },
  { value: 'verts', label: 'Verts' },
  { value: 'marron', label: 'Marron' },
  { value: 'noisette', label: 'Noisette' },
  { value: 'gris', label: 'Gris' },
  { value: 'noirs', label: 'Noirs' },
];

const STYLES: QuestionOption[] = [
  { value: 'casual', label: 'Casual' },
  { value: 'chic', label: 'Chic' },
  { value: 'streetwear', label: 'Streetwear' },
  { value: 'boheme', label: 'Bohème' },
  { value: 'rock', label: 'Rock' },
  { value: 'sportswear', label: 'Sportswear' },
  { value: 'classique', label: 'Classique' },
  { value: 'minimaliste', label: 'Minimaliste' },
];

/** Pilosité (une réponse, facultative) : remplace les signes distinctifs. */
const PILOSITY: QuestionOption[] = [
  { value: 'imberbe', label: 'Imberbe' },
  { value: 'barbe_courte', label: 'Barbe de quelques jours' },
  { value: 'barbe', label: 'Barbe' },
  { value: 'moustache', label: 'Moustache' },
  { value: 'poilu', label: { m: 'Poilu', f: 'Poilue', x: 'Poilu·e' } },
];

const HEIGHTS: QuestionOption[] = [
  { value: 'moins_160', label: 'Moins de 1m60' },
  { value: '160_169', label: '1m60 à 1m69' },
  { value: '170_179', label: '1m70 à 1m79' },
  { value: '180_189', label: '1m80 à 1m89' },
  { value: 'plus_190', label: '1m90 et plus' },
];

const VALUES: QuestionOption[] = [
  { value: 'famille', label: 'Famille' },
  { value: 'fidelite', label: 'Fidélité' },
  { value: 'honnetete', label: 'Honnêteté' },
  { value: 'humour', label: 'Humour' },
  { value: 'ambition', label: 'Ambition' },
  { value: 'bienveillance', label: 'Bienveillance' },
  { value: 'respect', label: 'Respect' },
  { value: 'liberte', label: 'Liberté' },
  { value: 'aventure', label: 'Aventure' },
  { value: 'stabilite', label: 'Stabilité' },
  { value: 'generosite', label: 'Générosité' },
  { value: 'curiosite', label: 'Curiosité' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'independance', label: 'Indépendance' },
  { value: 'partage', label: 'Partage' },
  { value: 'ecologie', label: 'Écologie' },
];

export const MAX_VALUES = 3;

export const QUESTIONS: readonly Question[] = [
  { key: 'silhouette', section: 'me', title: 'Ta silhouette', short: 'Silhouette', options: SILHOUETTES, multi: false, required: true },
  { key: 'hairColor', section: 'me', title: 'Tes cheveux, côté couleur', short: 'Cheveux', options: HAIR_COLORS, multi: false, required: true },
  { key: 'hairLength', section: 'me', title: 'Et côté longueur', short: 'Longueur', options: HAIR_LENGTHS, multi: false, required: true },
  { key: 'eyes', section: 'me', title: 'Tes yeux', short: 'Yeux', options: EYES, multi: false, required: true },
  // Plusieurs styles possibles, sans l'écrire : on coche ce qui nous ressemble.
  { key: 'style', section: 'me', title: 'Ton style', short: 'Style', options: STYLES, multi: true, quietMulti: true, required: true },
  { key: 'pilosity', section: 'me', title: 'Ta pilosité', short: 'Pilosité', options: PILOSITY, multi: false, required: false, notFor: 'f' },
  { key: 'seekHeights', section: 'seek', title: 'Sa taille', short: 'Taille', hint: 'Plusieurs réponses possibles.', options: HEIGHTS, multi: true, required: false, anyLabel: ANY },
  { key: 'seekSilhouettes', section: 'seek', title: 'Sa silhouette', short: 'Silhouette', hint: 'Plusieurs réponses possibles.', options: SILHOUETTES, multi: true, required: false, anyLabel: ANY },
  { key: 'seekHairColors', section: 'seek', title: 'Ses cheveux', short: 'Cheveux', hint: 'Plusieurs réponses possibles.', options: HAIR_COLORS, multi: true, required: false, anyLabel: ANY },
  { key: 'seekEyes', section: 'seek', title: 'Ses yeux', short: 'Yeux', hint: 'Plusieurs réponses possibles.', options: EYES, multi: true, required: false, anyLabel: ANY },
  { key: 'seekStyles', section: 'seek', title: 'Son style', short: 'Style', hint: 'Plusieurs réponses possibles.', options: STYLES, multi: true, required: false, anyLabel: ANY },
  { key: 'values', section: 'values', title: 'Tes valeurs', short: 'Ses valeurs', shortMine: 'Mes valeurs', hint: `De 1 à ${MAX_VALUES} réponses.`, options: VALUES, multi: true, max: MAX_VALUES, required: true },
  {
    key: 'seekValues',
    section: 'values',
    title: 'Les valeurs que tu recherches',
    short: 'Recherche',
    options: VALUES,
    multi: true,
    max: MAX_VALUES,
    required: false,
    anyLabel: ANY,
  },
];

export const SECTION_LABELS: Record<QuestionSection, string> = {
  me: 'Toi',
  seek: 'Ce que tu recherches',
  values: 'Tes valeurs',
};

/** Titres des parties sur la carte de quelqu'un d'autre. */
export const CARD_SECTION_LABELS: Record<QuestionSection, string> = {
  me: 'Physique',
  seek: 'Recherche',
  values: 'Valeurs',
};

/** Questions posées à une personne de ce genre (pas de pilosité pour les femmes). */
export function questionsFor(kind: GenderKind): readonly Question[] {
  return QUESTIONS.filter((question) => question.notFor !== kind);
}

export function genderKind(gender: string | null | undefined): GenderKind {
  const g = gender?.trim().toLowerCase();
  if (g === 'une femme') return 'f';
  if (g === 'un homme') return 'm';
  return 'x';
}

export function optionLabel(option: QuestionOption, kind: 'm' | 'f' | 'x'): string {
  return typeof option.label === 'string' ? option.label : option.label[kind];
}

/** Réponses d'une question, toujours en liste (vide = sans réponse ou « Peu importe »). */
export function answersOf(q: Questionnaire | null | undefined, key: QuestionKey): string[] {
  const value = q?.[key];
  if (Array.isArray(value)) return value;
  return typeof value === 'string' && value ? [value] : [];
}

/** Réponse lisible (« Bruns », « Bleus, Verts », « Peu importe »), ou null sans réponse. */
export function formatAnswer(question: Question, q: Questionnaire | null | undefined, kind: 'm' | 'f' | 'x'): string | null {
  const values = answersOf(q, question.key);
  if (values.length === 0) {
    if (question.anyLabel && Array.isArray(q?.[question.key])) return question.anyLabel;
    return null;
  }
  const labels = values.map((v) => question.options.find((o) => o.value === v)).filter((o): o is QuestionOption => !!o);
  return labels.map((o) => optionLabel(o, question.section === 'me' || question.key === 'values' ? kind : 'x')).join(', ');
}

/** Vrai quand la question a la réponse qu'il lui faut pour continuer. */
export function isAnswered(question: Question, q: Questionnaire | null | undefined): boolean {
  return !question.required || answersOf(q, question.key).length > 0;
}

/** Questions obligatoires restées sans réponse (même règle que le serveur). */
export function missingRequired(q: Questionnaire | null | undefined): Question[] {
  return QUESTIONS.filter((question) => !isAnswered(question, q));
}

export function isQuestionnaireComplete(q: Questionnaire | null | undefined): boolean {
  return missingRequired(q).length === 0;
}

/**
 * Questionnaire tel qu'il part à l'API : ce qui est recherché est toujours
 * envoyé (liste vide = « Peu importe ») pour distinguer un choix d'un oubli.
 */
export function completeQuestionnaire(q: Questionnaire | null | undefined): Questionnaire {
  const out: Questionnaire = { ...(q ?? {}) };
  // Retirés : signes distinctifs (remplacés par la pilosité).
  delete (out as Record<string, unknown>).features;
  for (const question of QUESTIONS) {
    // Une chaîne (style d'avant le choix multiple) devient une liste.
    if (question.multi) (out[question.key] as string[]) = answersOf(out, question.key);
  }
  return out;
}

/** Bascule d'une réponse : choix unique remplacé, choix multiple ajouté / retiré (plafond respecté). */
export function toggleAnswer(q: Questionnaire, question: Question, value: string): Questionnaire {
  if (!question.multi) return { ...q, [question.key]: value };
  const current = answersOf(q, question.key);
  if (current.includes(value)) return { ...q, [question.key]: current.filter((v) => v !== value) };
  if (question.max && current.length >= question.max) return q;
  // Ordre du catalogue, comme le serveur.
  const next = question.options.map((o) => o.value).filter((v) => v === value || current.includes(v));
  return { ...q, [question.key]: next };
}
