/**
 * Inscription du site : même parcours que l'app (mobile/screens/onboarding/
 * OnboardingFlow.tsx), mêmes règles, mêmes routes d'API. Le compte créé ici
 * est un compte Kiess : on s'y connecte ensuite dans l'app.
 *
 *   accueil (conditions + façon de s'inscrire)
 *     → Apple / Google / Facebook / Discord      → e-mail
 *     → numéro → code SMS                         → e-mail
 *   e-mail → prénom → nom → pseudo → genre → date de naissance
 *   → questionnaire (13 questions, une à la fois) → ville → mot de passe
 *   → photo → POST /auth/complete-signup → « Bravo ! »
 *
 * Questionnaire : celui de l'app (copie dans ./questionnaire.ts) ; il
 * remplace les badges « Critères physiques » et il est obligatoire avant le
 * premier matchmaking.
 * Un compte déjà complet (connexion sociale ou numéro déjà inscrits) affiche
 * « Déjà inscrit·e » au lieu de reprendre l'inscription.
 */
import type { Provider } from '../config';
import { api, ApiError, DEMO, hasSession, type Profile } from './api';
import { devToken, isAvailable, PROVIDER_LABELS, redirectUri, startOAuth, usesDevToken, type OAuthReturn } from './oauth';
import { MAX_INPUT_BYTES, toSquareJpeg } from './photo';
import {
  answersOf,
  completeQuestionnaire,
  genderKind,
  isAnswered,
  optionLabel,
  QUESTIONS,
  SECTION_LABELS,
  toggleAnswer,
  type Questionnaire,
} from './questionnaire';
import {
  ADULT_AGE,
  ageFromIso,
  composeE164,
  formatBirthDateFromIso,
  formatBirthDateInput,
  isValidCity,
  isValidE164,
  isValidEmail,
  isValidName,
  isValidOtp,
  isValidPassword,
  isValidUsername,
  normalizeEmail,
  normalizeUsername,
  parseBirthDate,
} from './validation';

type Step =
  | 'welcome'
  | 'phone'
  | 'phoneCode'
  | 'email'
  | 'firstName'
  | 'lastName'
  | 'username'
  | 'gender'
  | 'birthDate'
  | 'questionnaire'
  | 'city'
  | 'password'
  | 'photo'
  | 'success'
  | 'existing';
type Method = Provider | 'phone';

const PROFILE_STEPS: Step[] = ['email', 'firstName', 'lastName', 'username', 'gender', 'birthDate', 'questionnaire', 'city', 'password', 'photo'];
const PATHS: Record<'phone' | 'social', Step[]> = {
  phone: ['welcome', 'phone', 'phoneCode', ...PROFILE_STEPS],
  social: ['welcome', ...PROFILE_STEPS],
};
const DONE: Step[] = ['success', 'existing'];

/** Mémorisé le temps de l'aller-retour chez le fournisseur ou d'un rechargement. */
const STATE_KEY = 'kiess_signup_state';

/** Textes repris de l'app (mobile/i18n/fr.onboarding.ts). */
const MSG = {
  terms: 'Merci de valider les termes et conditions pour continuer',
  phone: 'Ton numéro de téléphone ne semble pas valide',
  otp: 'Ton code n’est pas correct',
  email: 'Ton adresse mail ne semble pas valide',
  firstName: 'Ton prénom ne semble pas valide',
  lastName: 'Ton nom ne semble pas valide',
  username: 'Ton pseudo doit faire 2 à 20 caractères, sans espace',
  gender: 'Tu dois choisir ton genre, tu pourras le modifier plus tard',
  birthDateFormat: 'Entre une date valide au format JJ/MM/AAAA',
  tooYoung: 'Tu es trop jeune pour utiliser Kiess',
  questionSingle: 'Choisis une réponse pour continuer',
  questionMulti: 'Choisis au moins une réponse pour continuer',
  city: 'Entre le nom de ta ville',
  passwordEmpty: 'Entre et confirme ton mot de passe',
  passwordRules: 'Ton mot de passe doit contenir au moins 8 caractères, des majuscules et des chiffres',
  passwordMismatch: 'Tes mots de passe ne sont pas identiques',
  photoMissing: 'Ajoute une photo de profil pour continuer',
  photoInvalid: 'Ta photo n’est pas valide',
  photoNoFace: 'Aucun visage détecté. Utilise une photo où ton visage est clairement visible',
  photoManyFaces: 'Plusieurs personnes détectées. Utilise une photo où tu es seul·e',
  photoTooBig: 'Cette photo est trop lourde. Choisis une image de moins de 15 Mo',
  photoFormat: 'Ce format de photo n’est pas pris en charge. Choisis une photo JPEG ou PNG',
  conflict: 'Cette adresse mail ou ce pseudo est déjà utilisé',
  invalid: 'Vérifie les informations saisies avant de continuer',
  tooMany: 'Trop de tentatives. Réessaie dans 15 minutes',
  network: 'Connexion au serveur impossible. Vérifie ta connexion et réessaie',
  server: 'Une erreur est survenue. Réessaie dans quelques instants',
  sessionExpired: 'Connexion expirée. Recommence ton inscription',
  socialCancelled: (p: string) => `Connexion ${p} annulée`,
  socialFailed: (p: string) => `Connexion ${p} impossible pour le moment. Réessaie`,
};

interface Hooks {
  onOpen?: () => void;
  onClose?: () => void;
  onSuccess?: () => void;
}

interface SavedState {
  method: Method;
  acceptedTerms: boolean;
}

export function initSignup(hooks: Hooks = {}) {
  const dialog = document.getElementById('signupDialog') as HTMLDialogElement;
  const form = document.getElementById('signupForm') as HTMLFormElement;
  const steps = new Map(
    Array.from(form.querySelectorAll<HTMLElement>('.bd-step')).map((el) => [el.dataset.step as Step, el]),
  );
  const back = document.getElementById('suBack') as HTMLButtonElement;
  const close = document.getElementById('suClose') as HTMLButtonElement;
  const progress = document.getElementById('suProgress') as HTMLElement;
  const actions = document.getElementById('suActions') as HTMLElement;
  const next = document.getElementById('suNext') as HTMLButtonElement;
  const nextLabel = document.getElementById('suNextLabel') as HTMLElement;
  const live = document.getElementById('suLive') as HTMLElement;
  const methodButtons = Array.from(form.querySelectorAll<HTMLButtonElement>('[data-method]'));
  const input = <T extends Element = HTMLInputElement>(name: string) => form.elements.namedItem(name) as unknown as T;

  let current: Step = 'welcome';
  let method: Method | null = null;
  let normalizedPhone = '';
  let photo: { fileUrl: string; preview: string } | null = null;
  let busy = false;
  // Questionnaire : réponses et question affichée (une à la fois).
  let questionnaire: Questionnaire = {};
  let qIndex = 0;

  // Fournisseurs non configurés : boutons masqués (sauf en développement).
  methodButtons.forEach((b) => {
    const m = b.dataset.method as Method;
    if (m !== 'phone' && !isAvailable(m)) b.hidden = true;
  });

  // ── Ouverture / fermeture ──────────────────────────────────────────────
  document.querySelectorAll<HTMLElement>('[data-open-signup]').forEach((b) => b.addEventListener('click', () => open()));
  close.addEventListener('click', () => dialog.close());
  form.querySelectorAll<HTMLElement>('[data-close]').forEach((b) => b.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog && !busy) dialog.close();
  });
  dialog.addEventListener('cancel', (e) => {
    if (busy) e.preventDefault();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('dialog-open');
    hooks.onClose?.();
    if (DONE.includes(current)) reset();
  });

  function open() {
    if (dialog.open) return;
    dialog.showModal();
    document.documentElement.classList.add('dialog-open');
    hooks.onOpen?.();
    if (current === 'welcome' && hasSession()) {
      // Inscription commencée dans cet onglet (page rechargée) : on reprend.
      const saved = readState();
      method = saved?.method ?? null;
      input('acceptedTerms').checked = saved?.acceptedTerms ?? false;
      void run(afterSession);
      return;
    }
    show(current, false);
  }

  function reset() {
    form.reset();
    form.querySelectorAll<HTMLElement>('[data-error]').forEach((e) => (e.textContent = ''));
    steps.forEach((s) => s.classList.remove('has-error'));
    clearPhoto();
    updatePwRules();
    questionnaire = {};
    qIndex = 0;
    method = null;
    normalizedPhone = '';
    clearState();
    show('welcome', false);
  }

  // ── Navigation ─────────────────────────────────────────────────────────
  const path = () => PATHS[method === 'phone' ? 'phone' : 'social'];

  function show(step: Step, focus = true) {
    const order = [...path(), ...DONE];
    const index = order.indexOf(step);
    current = step;
    if (step === 'questionnaire') renderQuestion();
    steps.forEach((el, key) => {
      const active = key === step;
      el.classList.toggle('is-active', active);
      el.classList.toggle('is-before', order.indexOf(key) < index);
      el.toggleAttribute('inert', !active);
    });
    const done = DONE.includes(step);
    const p = path();
    progress.style.setProperty('--p', String(done ? 1 : Math.max(0, p.indexOf(step)) / (p.length - 1)));
    progress.toggleAttribute('hidden', done);
    back.hidden = step === 'welcome' || done;
    actions.hidden = step === 'welcome' || done;
    nextLabel.textContent = step === 'photo' ? 'Créer mon compte' : 'Continuer';
    if (!done) live.textContent = step === 'welcome' ? 'Inscription à Kiess' : `Étape ${p.indexOf(step)} sur ${p.length - 1}`;
    if (step === 'questionnaire') live.textContent += `, question ${qIndex + 1} sur ${QUESTIONS.length}`;
    if (focus) {
      window.setTimeout(() => {
        const el = steps.get(step)!;
        if (done) el.focus();
        else el.querySelector<HTMLElement>('input:not([type=hidden]):not([type=file]), button, [tabindex="-1"]')?.focus({ preventScroll: true });
      }, 320);
    }
  }

  function go(offset: 1 | -1) {
    const p = path();
    const target = p[p.indexOf(current) + offset];
    if (target) show(target);
  }

  back.addEventListener('click', () => {
    if (busy) return;
    if (current === 'phoneCode') input('otp').value = '';
    // Questionnaire : question précédente, puis l'étape d'avant.
    if (current === 'questionnaire' && qIndex > 0) {
      setError('questionnaire', '');
      qIndex -= 1;
      renderQuestion('back');
      return;
    }
    go(-1);
  });

  // ── Erreurs ────────────────────────────────────────────────────────────
  function setError(step: Step, msg: string) {
    const el = steps.get(step);
    const box = el?.querySelector<HTMLElement>('[data-error]');
    if (!el || !box) return;
    box.textContent = msg;
    el.classList.toggle('has-error', !!msg);
    if (msg) {
      live.textContent = msg;
      el.classList.remove('shake');
      void el.offsetWidth;
      el.classList.add('shake');
    }
  }

  function apiMessage(e: unknown): string {
    if (!(e instanceof ApiError)) return MSG.server;
    if (e.status === 0) return MSG.network;
    if (e.status === 429) return e.message || MSG.tooMany;
    return MSG.server;
  }

  /** Exécute une action réseau : bouton occupé, une seule à la fois. */
  async function run(action: () => Promise<void>, label = 'Patiente…') {
    if (busy) return;
    busy = true;
    form.classList.add('is-busy');
    next.disabled = true;
    next.classList.add('is-loading');
    methodButtons.forEach((b) => (b.disabled = true));
    const previous = nextLabel.textContent;
    nextLabel.textContent = label;
    try {
      await action();
    } finally {
      busy = false;
      form.classList.remove('is-busy');
      next.disabled = false;
      next.classList.remove('is-loading');
      methodButtons.forEach((b) => (b.disabled = false));
      if (nextLabel.textContent === label) nextLabel.textContent = previous;
      if (current === 'photo') nextLabel.textContent = 'Créer mon compte';
    }
  }

  // ── Accueil : façon de s'inscrire ──────────────────────────────────────
  methodButtons.forEach((b) =>
    b.addEventListener('click', () => {
      if (busy) return;
      if (!input('acceptedTerms').checked) {
        setError('welcome', MSG.terms);
        return;
      }
      setError('welcome', '');
      void choose(b.dataset.method as Method);
    }),
  );
  input('acceptedTerms').addEventListener('change', () => {
    if (input('acceptedTerms').checked) setError('welcome', '');
  });

  async function choose(next: Method) {
    if (hasSession()) await api.endSession(); // nouvelle tentative : l'ancienne session est fermée
    method = next;
    saveState();
    if (next === 'phone') {
      show('phone');
      return;
    }
    if (!DEMO && !usesDevToken(next)) {
      startOAuth(next); // la page part chez le fournisseur et revient sur l'accueil
      return;
    }
    await run(async () => {
      try {
        await api.social(next, devToken(next), redirectUri());
      } catch (e) {
        setError('welcome', e instanceof ApiError && e.status === 401 ? MSG.socialFailed(PROVIDER_LABELS[next]) : apiMessage(e));
        return;
      }
      await afterSession();
    });
  }

  /** Retour d'un fournisseur (appelé au chargement de la page). */
  async function resumeOAuth(result: OAuthReturn) {
    const saved = readState();
    if (saved?.acceptedTerms) input('acceptedTerms').checked = true;
    method = result.provider ?? saved?.method ?? null;
    if (hasSession()) await api.endSession(); // ancienne tentative restée ouverte
    open();
    show('welcome', false);
    if (!result.ok) {
      const label = result.provider ? PROVIDER_LABELS[result.provider] : 'sociale';
      setError('welcome', result.reason === 'cancelled' ? MSG.socialCancelled(label) : MSG.socialFailed(label));
      return;
    }
    await run(async () => {
      try {
        await api.social(result.provider, result.token, redirectUri());
      } catch (e) {
        setError('welcome', e instanceof ApiError && e.status === 401 ? MSG.socialFailed(PROVIDER_LABELS[result.provider]) : apiMessage(e));
        return;
      }
      if (result.email && !input('email').value) input('email').value = result.email;
      await afterSession();
    }, 'Connexion…');
  }

  /** Session ouverte (SMS ou fournisseur) : compte déjà complet, ou suite du parcours. */
  async function afterSession() {
    let profile: Profile;
    try {
      profile = await api.getProfile();
    } catch (e) {
      await api.endSession();
      show('welcome');
      setError('welcome', e instanceof ApiError && e.status === 401 ? MSG.sessionExpired : apiMessage(e));
      return;
    }
    if (profile.onboardingStage === 'complete') {
      await api.endSession();
      clearState();
      const how = method && method !== 'phone' ? `avec ${PROVIDER_LABELS[method]}` : 'avec ton e-mail ou ton pseudo et ton mot de passe';
      document.getElementById('suExistingText')!.textContent = `Tu as déjà un compte Kiess. Connecte-toi directement dans l’app ${how}.`;
      show('existing');
      return;
    }
    prefill(profile);
    show('email');
  }

  /** Reprend ce que le compte connaît déjà (comme draftFromProfile dans l'app). */
  function prefill(profile: Profile) {
    const placeholder = (v?: string) => !v || /^(prénom|prenom)$/i.test(v) || /^(utilisateur|test) /i.test(v);
    const fill = (name: string, value?: string) => {
      const el = input(name);
      if (value && !el.value) el.value = value;
    };
    if (!placeholder(profile.firstName)) fill('firstName', profile.firstName);
    fill('lastName', profile.lastName);
    fill('username', profile.username);
    fill('city', profile.city);
    fill('birthDate', formatBirthDateFromIso(profile.birthDate));
    if (profile.gender) {
      const radio = form.querySelector<HTMLInputElement>(`input[name=gender][value="${CSS.escape(profile.gender)}"]`);
      if (radio) radio.checked = true;
    }
    if (profile.questionnaire && Object.keys(questionnaire).length === 0) questionnaire = { ...profile.questionnaire };
  }

  // ── Continuer ──────────────────────────────────────────────────────────
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (busy || current === 'welcome' || DONE.includes(current)) return;
    const error = validate(current);
    setError(current, error);
    if (error) return;
    if (current === 'phone') void run(sendCode, 'Envoi…');
    else if (current === 'phoneCode') void run(checkCode, 'Vérification…');
    else if (current === 'photo') void run(complete, 'Création…');
    else if (current === 'questionnaire' && qIndex < QUESTIONS.length - 1) nextQuestion();
    else go(1);
  });

  function validate(step: Step): string {
    const value = (name: string) => input(name).value;
    switch (step) {
      case 'phone':
        return isValidE164(composeE164(value('phone'))) ? '' : MSG.phone;
      case 'phoneCode':
        return isValidOtp(value('otp')) ? '' : MSG.otp;
      case 'email':
        return isValidEmail(value('email')) ? '' : MSG.email;
      case 'firstName':
        return isValidName(value('firstName')) ? '' : MSG.firstName;
      case 'lastName':
        return isValidName(value('lastName')) ? '' : MSG.lastName;
      case 'username':
        return isValidUsername(value('username')) ? '' : MSG.username;
      case 'gender':
        return form.querySelector('input[name=gender]:checked') ? '' : MSG.gender;
      case 'birthDate': {
        const iso = parseBirthDate(value('birthDate'));
        if (!iso || ageFromIso(iso) > 110) return MSG.birthDateFormat;
        return ageFromIso(iso) >= ADULT_AGE ? '' : MSG.tooYoung;
      }
      case 'questionnaire': {
        const question = QUESTIONS[qIndex];
        if (isAnswered(question, questionnaire)) return '';
        return question.multi ? MSG.questionMulti : MSG.questionSingle;
      }
      case 'city':
        return isValidCity(value('city')) ? '' : MSG.city;
      case 'password': {
        const pw = value('password');
        const confirm = value('passwordConfirm');
        if (!pw || !confirm) return MSG.passwordEmpty;
        if (!isValidPassword(pw)) return MSG.passwordRules;
        return pw === confirm ? '' : MSG.passwordMismatch;
      }
      case 'photo':
        return photo ? '' : MSG.photoMissing;
      default:
        return '';
    }
  }

  // Effacer l'erreur dès que la saisie redevient valide
  form.addEventListener('input', () => {
    if (steps.get(current)?.classList.contains('has-error') && !validate(current)) setError(current, '');
  });

  // ── Numéro + code SMS ──────────────────────────────────────────────────
  async function sendCode() {
    normalizedPhone = composeE164(input('phone').value);
    try {
      const { code } = await api.requestOtp(normalizedPhone);
      document.getElementById('suPhoneEcho')!.textContent = normalizedPhone;
      // Code renvoyé uniquement par une API de développement (jamais en production).
      const dev = document.getElementById('suDevCode')!;
      dev.hidden = !code;
      dev.textContent = code ? `Code de test (API de développement) : ${code}` : '';
      input('otp').value = '';
      show('phoneCode');
    } catch (e) {
      setError('phone', e instanceof ApiError && e.status === 400 ? MSG.phone : apiMessage(e));
    }
  }

  async function checkCode() {
    try {
      await api.verifyOtp(normalizedPhone, input('otp').value.trim());
    } catch (e) {
      setError('phoneCode', e instanceof ApiError && (e.status === 401 || e.status === 400) ? MSG.otp : apiMessage(e));
      return;
    }
    await afterSession();
  }

  // ── Photo ──────────────────────────────────────────────────────────────
  const photoInput = input('photo');
  const preview = document.getElementById('suPhotoPreview') as HTMLImageElement;
  const photoPick = document.getElementById('suPhotoPick') as HTMLElement;
  const photoLabel = document.getElementById('suPhotoLabel') as HTMLElement;

  function clearPhoto() {
    if (photo) URL.revokeObjectURL(photo.preview);
    photo = null;
    preview.hidden = true;
    preview.removeAttribute('src');
    photoPick.classList.remove('has-photo');
    photoLabel.textContent = 'Choisir une photo';
  }

  photoInput.addEventListener('change', () => {
    const file = photoInput.files?.[0];
    photoInput.value = '';
    if (!file || busy) return;
    if (file.size > MAX_INPUT_BYTES) {
      setError('photo', MSG.photoTooBig);
      return;
    }
    void run(async () => {
      setError('photo', '');
      photoLabel.textContent = 'Vérification…';
      photoPick.classList.add('is-checking');
      try {
        let jpeg: Blob;
        try {
          jpeg = await toSquareJpeg(file);
        } catch {
          setError('photo', MSG.photoFormat);
          return;
        }
        let result: Awaited<ReturnType<typeof api.uploadPhoto>>;
        try {
          result = await api.uploadPhoto(jpeg);
        } catch (e) {
          setError('photo', await handleAuthError(e));
          return;
        }
        if (!result.approved) {
          setError('photo', result.faceCount === 0 ? MSG.photoNoFace : result.faceCount > 1 ? MSG.photoManyFaces : MSG.photoInvalid);
          return;
        }
        clearPhoto();
        photo = { fileUrl: result.fileUrl, preview: URL.createObjectURL(jpeg) };
        preview.src = photo.preview;
        preview.hidden = false;
        photoPick.classList.add('has-photo');
      } finally {
        photoPick.classList.remove('is-checking');
        photoLabel.textContent = photo ? 'Changer de photo' : 'Choisir une photo';
      }
    }, 'Vérification…');
  });

  /** Session expirée pendant le parcours : retour à l'accueil. */
  async function handleAuthError(e: unknown): Promise<string> {
    if (e instanceof ApiError && e.status === 401) {
      await api.endSession();
      show('welcome');
      setError('welcome', MSG.sessionExpired);
      return MSG.sessionExpired;
    }
    return apiMessage(e);
  }

  // ── Fin d'inscription ──────────────────────────────────────────────────
  async function complete() {
    const iso = parseBirthDate(input('birthDate').value);
    if (!iso || !photo) {
      setError('photo', MSG.invalid);
      return;
    }
    try {
      await api.completeSignup({
        email: normalizeEmail(input('email').value),
        password: input('password').value,
        firstName: input('firstName').value.trim(),
        lastName: input('lastName').value.trim(),
        username: normalizeUsername(input('username').value),
        gender: form.querySelector<HTMLInputElement>('input[name=gender]:checked')!.value,
        birthDate: iso,
        city: input('city').value.trim(),
        marketingOptIn: input('marketingOptIn').checked,
        acceptedTerms: true,
        acceptedPrivacy: true,
        photoUrl: DEMO ? undefined : photo.fileUrl,
        // Ce qui est recherché part toujours : liste vide = « Peu importe ».
        questionnaire: completeQuestionnaire(questionnaire),
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // « Adresse mail déjà utilisée » / « Pseudo déjà utilisé »
        const target: Step = /pseudo/i.test(e.message) ? 'username' : /adresse|mail/i.test(e.message) ? 'email' : 'photo';
        show(target);
        setError(target, e.message || MSG.conflict);
        return;
      }
      setError('photo', e instanceof ApiError && e.status === 400 ? MSG.invalid : await handleAuthError(e));
      return;
    }

    // Aucune trace du mot de passe dans la page ; session du site fermée.
    input('password').value = '';
    input('passwordConfirm').value = '';
    await api.endSession();
    clearState();
    const how = method && method !== 'phone' ? `avec ${PROVIDER_LABELS[method]} ou ` : 'avec ';
    document.getElementById('suSuccessText')!.textContent =
      `Tu as terminé ton inscription. Dans l’app Kiess, connecte-toi ${how}ton adresse mail et ton mot de passe.`;
    (document.getElementById('suDemo') as HTMLElement).hidden = !DEMO;
    show('success');
    rainHearts();
    hooks.onSuccess?.();
  }

  // ── Questionnaire : une question à la fois ─────────────────────────────
  const qList = document.getElementById('suQList') as HTMLElement;
  const qTitle = document.getElementById('suQTitle') as HTMLElement;
  const qHint = document.getElementById('suQHint') as HTMLElement;
  const qSection = document.getElementById('suQSection') as HTMLElement;
  const qCount = document.getElementById('suQCount') as HTMLElement;
  const qBar = document.getElementById('suQBar') as HTMLElement;
  const ANY_VALUE = '__any__';

  function nextQuestion() {
    setError('questionnaire', '');
    qIndex += 1;
    renderQuestion('forward');
    live.textContent = `Question ${qIndex + 1} sur ${QUESTIONS.length}`;
    window.setTimeout(() => qList.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true }), 120);
  }

  /** Affiche la question courante : intitulé, aide, réponses (accordées au genre choisi). */
  function renderQuestion(direction?: 'forward' | 'back') {
    const question = QUESTIONS[qIndex];
    const gender = form.querySelector<HTMLInputElement>('input[name=gender]:checked')?.value;
    const kind = question.section === 'me' || question.key === 'values' ? genderKind(gender) : 'x';
    qSection.textContent = SECTION_LABELS[question.section];
    qCount.textContent = `${qIndex + 1}/${QUESTIONS.length}`;
    qBar.style.setProperty('--q', String((qIndex + 1) / QUESTIONS.length));
    qTitle.textContent = question.title;
    qHint.textContent = question.hint ?? '';
    qHint.hidden = !question.hint;
    qList.setAttribute('role', question.multi ? 'group' : 'radiogroup');
    const options = [...(question.anyLabel ? [{ value: ANY_VALUE, label: question.anyLabel }] : []), ...question.options];
    qList.classList.toggle('is-long', options.length > 8);
    const chosen = answersOf(questionnaire, question.key);
    qList.replaceChildren(
      ...options.map((option) => {
        const row = document.createElement('label');
        const any = option.value === ANY_VALUE;
        const multi = question.multi && !any;
        row.className = multi ? 'q-row is-multi' : 'q-row';
        const el = document.createElement('input');
        el.type = multi ? 'checkbox' : 'radio';
        el.name = `q-${question.key}`;
        el.value = option.value;
        // « Peu importe » coché tant que rien n'est choisi, comme dans l'app.
        el.checked = any ? chosen.length === 0 : chosen.includes(option.value);
        const mark = document.createElement('span');
        mark.className = 'q-mark';
        mark.setAttribute('aria-hidden', 'true');
        const text = document.createElement('span');
        text.textContent = any ? (option.label as string) : optionLabel(option, kind);
        row.append(el, mark, text);
        el.addEventListener('change', () => onAnswer(option.value));
        return row;
      }),
    );
    if (direction) {
      qList.classList.remove('q-swap', 'is-back');
      void qList.offsetWidth;
      qList.classList.add('q-swap');
      qList.classList.toggle('is-back', direction === 'back');
    }
  }

  function onAnswer(value: string) {
    const question = QUESTIONS[qIndex];
    questionnaire = value === ANY_VALUE ? { ...questionnaire, [question.key]: [] } : toggleAnswer(questionnaire, question, value);
    setError('questionnaire', '');
    // Réponses cochées = état réel (plafond de 3 valeurs, « Peu importe » exclusif).
    const chosen = answersOf(questionnaire, question.key);
    qList.querySelectorAll<HTMLInputElement>('input').forEach((el) => {
      el.checked = el.value === ANY_VALUE ? chosen.length === 0 : chosen.includes(el.value);
    });
    // Choix unique : on passe à la question suivante, comme pour le genre.
    if (!question.multi) {
      const at = qIndex;
      window.setTimeout(() => {
        if (current !== 'questionnaire' || qIndex !== at) return;
        if (qIndex < QUESTIONS.length - 1) nextQuestion();
        else go(1);
      }, 260);
    }
  }

  // ── Détails de saisie ──────────────────────────────────────────────────
  form.querySelectorAll<HTMLInputElement>('input[name=gender]').forEach((r) =>
    r.addEventListener('change', () => {
      setError('gender', '');
      window.setTimeout(() => current === 'gender' && go(1), 260);
    }),
  );

  const birth = input('birthDate');
  birth.addEventListener('input', () => (birth.value = formatBirthDateInput(birth.value)));
  const otp = input('otp');
  otp.addEventListener('input', () => (otp.value = otp.value.replace(/\D/g, '').slice(0, 6)));
  const username = input('username');
  username.addEventListener('input', () => (username.value = username.value.replace(/\s/g, '')));

  const pwInput = input('password');
  const rules = document.getElementById('suPwRules') as HTMLElement;
  function updatePwRules() {
    const v = pwInput.value;
    rules.querySelector('[data-rule=len]')!.classList.toggle('ok', v.length >= 8);
    rules.querySelector('[data-rule=upper]')!.classList.toggle('ok', /[A-Z]/.test(v));
    rules.querySelector('[data-rule=digit]')!.classList.toggle('ok', /\d/.test(v));
  }
  pwInput.addEventListener('input', updatePwRules);
  form.querySelector<HTMLButtonElement>('[data-pw-toggle]')!.addEventListener('click', (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    const visible = pwInput.type === 'password';
    pwInput.type = visible ? 'text' : 'password';
    input('passwordConfirm').type = visible ? 'text' : 'password';
    btn.textContent = visible ? 'Masquer' : 'Voir';
    btn.setAttribute('aria-label', visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
  });

  function rainHearts() {
    const box = document.getElementById('suHearts')!;
    box.replaceChildren();
    for (let i = 0; i < 14; i++) {
      const img = document.createElement('img');
      img.src = `/assets/coeur${(i % 5) + 1}.webp`;
      img.alt = '';
      img.style.setProperty('--x', `${Math.random() * 100}%`);
      img.style.setProperty('--d', `${(Math.random() * 0.9).toFixed(2)}s`);
      img.style.setProperty('--s', `${(0.5 + Math.random() * 0.8).toFixed(2)}`);
      img.style.setProperty('--r', `${Math.round((Math.random() - 0.5) * 70)}deg`);
      box.appendChild(img);
    }
  }

  // ── État entre deux chargements (méthode, conditions acceptées) ────────
  function saveState() {
    if (!method) return;
    try {
      const state: SavedState = { method, acceptedTerms: input('acceptedTerms').checked };
      sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch {
      // stockage indisponible
    }
  }
  function readState(): SavedState | null {
    try {
      const raw = sessionStorage.getItem(STATE_KEY);
      return raw ? (JSON.parse(raw) as SavedState) : null;
    } catch {
      return null;
    }
  }
  function clearState() {
    try {
      sessionStorage.removeItem(STATE_KEY);
    } catch {
      // idem
    }
  }

  return { open, resumeOAuth };
}
