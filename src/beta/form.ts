/**
 * Formulaire de préinscription en 5 étapes, calqué sur l'onboarding mobile
 * (une question par écran sur la carte dégradé). Textes d'erreur repris de
 * mobile/i18n/fr.onboarding.ts quand ils existent.
 */
import { readSource, submitPreregistration, type Gender, type Preference } from './submit';

const STEP_COUNT = 5;

interface FormHooks {
  onOpen?: () => void;
  onClose?: () => void;
  onSuccess?: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function parseBirthDate(v: string): { iso: string; age: number } | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v.trim());
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  const now = new Date();
  let age = now.getFullYear() - y;
  const beforeBirthday = now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d);
  if (beforeBirthday) age -= 1;
  return { iso: `${m[3]}-${m[2]}-${m[1]}`, age };
}

export function initBetaForm(hooks: FormHooks = {}) {
  const dialog = document.getElementById('betaDialog') as HTMLDialogElement;
  const form = document.getElementById('betaForm') as HTMLFormElement;
  const steps = Array.from(form.querySelectorAll<HTMLElement>('.bd-step'));
  const progress = Array.from(dialog.querySelectorAll<HTMLElement>('.bd-progress i'));
  const back = document.getElementById('bdBack') as HTMLButtonElement;
  const close = document.getElementById('bdClose') as HTMLButtonElement;
  const next = document.getElementById('bdNext') as HTMLButtonElement;
  const nextLabel = document.getElementById('bdNextLabel') as HTMLElement;
  const actions = document.getElementById('bdActions') as HTMLElement;
  const live = document.getElementById('bdLive') as HTMLElement;
  const done = document.getElementById('bdDone') as HTMLButtonElement;
  const demoNote = document.getElementById('bdDemo') as HTMLElement;
  const el = <T extends Element>(name: string) => form.elements.namedItem(name) as unknown as T;

  let current = 0;
  let submitting = false;

  // ── Ouverture / fermeture ──────────────────────────────────────────────
  document.querySelectorAll<HTMLElement>('[data-open-beta]').forEach((b) =>
    b.addEventListener('click', () => open()),
  );
  close.addEventListener('click', () => dialog.close());
  done.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('dialog-open');
    hooks.onClose?.();
    if (current === STEP_COUNT) reset();
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  function open() {
    if (dialog.open) return;
    dialog.showModal();
    document.documentElement.classList.add('dialog-open');
    hooks.onOpen?.();
    show(current, false);
  }

  function reset() {
    form.reset();
    clearErrors();
    updatePwRules();
    current = 0;
    show(0, false);
  }

  // ── Navigation ─────────────────────────────────────────────────────────
  function show(i: number, focus = true) {
    current = i;
    steps.forEach((s, k) => {
      s.classList.toggle('is-active', k === i);
      s.classList.toggle('is-before', k < i);
      s.toggleAttribute('inert', k !== i);
    });
    progress.forEach((p, k) => p.classList.toggle('on', k <= i));
    back.hidden = i === 0 || i === STEP_COUNT;
    actions.hidden = i === STEP_COUNT;
    dialog.querySelector('.bd-progress')!.toggleAttribute('hidden', i === STEP_COUNT);
    nextLabel.textContent = i === STEP_COUNT - 1 ? 'Envoyer ma demande' : 'Continuer';
    if (i < STEP_COUNT) live.textContent = `Étape ${i + 1} sur ${STEP_COUNT}`;
    if (focus) {
      window.setTimeout(() => {
        const target = steps[i].querySelector<HTMLElement>('input:not([type=hidden]), [tabindex="-1"]') ?? steps[i];
        if (i === STEP_COUNT) steps[i].focus();
        else target.focus({ preventScroll: true });
      }, 320);
    }
  }

  back.addEventListener('click', () => {
    if (current > 0) show(current - 1);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitting) return;
    const err = validate(current);
    setError(current, err);
    if (err) {
      steps[current].classList.remove('shake');
      void steps[current].offsetWidth;
      steps[current].classList.add('shake');
      return;
    }
    if (current < STEP_COUNT - 1) {
      show(current + 1);
      return;
    }
    await send();
  });

  // ── Validation ─────────────────────────────────────────────────────────
  function validate(i: number): string {
    switch (i) {
      case 0: {
        const v = el<HTMLInputElement>('email').value.trim();
        return EMAIL_RE.test(v) ? '' : 'Ton adresse mail ne semble pas valide';
      }
      case 1: {
        const pw = el<HTMLInputElement>('password').value;
        const pc = el<HTMLInputElement>('passwordConfirm').value;
        if (pw.length < 8 || !/[A-Z]/.test(pw) || !/\d/.test(pw))
          return 'Ton mot de passe doit contenir au moins 8 caractères, des majuscules et des chiffres';
        if (pw !== pc) return 'Les mots de passe ne sont pas identiques';
        return '';
      }
      case 2:
        return form.querySelector('input[name=gender]:checked') ? '' : 'Tu dois choisir ton genre, tu pourras le modifier plus tard';
      case 3:
        return form.querySelector('input[name=preferences]:checked, input[name=preferencesAll]:checked')
          ? ''
          : 'Choisis au moins une option';
      case 4: {
        const parsed = parseBirthDate(el<HTMLInputElement>('birthDate').value);
        if (!parsed || parsed.age > 110) return 'Ta date de naissance ne semble pas valide (JJ/MM/AAAA)';
        if (parsed.age < 18) return 'Tu es trop jeune pour utiliser Kiess';
        if (!el<HTMLInputElement>('acceptedTerms').checked) return 'Merci de valider les termes et conditions pour continuer';
        return '';
      }
      default:
        return '';
    }
  }

  function setError(i: number, msg: string) {
    const box = steps[i]?.querySelector<HTMLElement>('[data-error]');
    if (!box) return;
    box.textContent = msg;
    steps[i].classList.toggle('has-error', !!msg);
    if (msg) live.textContent = msg;
  }
  function clearErrors() {
    steps.forEach((_, i) => setError(i, ''));
  }

  // Effacer l'erreur dès que l'utilisateur corrige
  form.addEventListener('input', () => {
    if (steps[current].classList.contains('has-error') && !validate(current)) setError(current, '');
  });

  // ── Détails d'interaction ──────────────────────────────────────────────
  // « Tout le monde » est exclusif avec les autres choix
  const all = el<HTMLInputElement>('preferencesAll');
  const prefs = Array.from(form.querySelectorAll<HTMLInputElement>('input[name=preferences]'));
  all.addEventListener('change', () => {
    if (all.checked) prefs.forEach((p) => (p.checked = false));
  });
  prefs.forEach((p) => p.addEventListener('change', () => p.checked && (all.checked = false)));

  // Choix unique (genre) : passer à l'étape suivante après sélection
  form.querySelectorAll<HTMLInputElement>('input[name=gender]').forEach((r) =>
    r.addEventListener('change', () => {
      setError(2, '');
      window.setTimeout(() => current === 2 && show(3), 260);
    }),
  );

  // Masque JJ/MM/AAAA
  const bd = el<HTMLInputElement>('birthDate');
  bd.addEventListener('input', () => {
    const digits = bd.value.replace(/\D/g, '').slice(0, 8);
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    bd.value = out;
  });

  // Règles du mot de passe en direct
  const pwInput = el<HTMLInputElement>('password');
  const rules = document.getElementById('pwRules') as HTMLElement;
  function updatePwRules() {
    const v = pwInput.value;
    rules.querySelector('[data-rule=len]')!.classList.toggle('ok', v.length >= 8);
    rules.querySelector('[data-rule=upper]')!.classList.toggle('ok', /[A-Z]/.test(v));
    rules.querySelector('[data-rule=digit]')!.classList.toggle('ok', /\d/.test(v));
  }
  pwInput.addEventListener('input', updatePwRules);
  form.querySelector<HTMLButtonElement>('[data-pw-toggle]')!.addEventListener('click', (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    const show = pwInput.type === 'password';
    pwInput.type = show ? 'text' : 'password';
    el<HTMLInputElement>('passwordConfirm').type = show ? 'text' : 'password';
    btn.textContent = show ? 'Masquer' : 'Voir';
    btn.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
  });

  // ── Envoi ──────────────────────────────────────────────────────────────
  async function send() {
    submitting = true;
    next.disabled = true;
    next.classList.add('is-loading');
    nextLabel.textContent = 'Envoi…';

    const parsed = parseBirthDate(bd.value)!;
    const preferences = all.checked ? [] : prefs.filter((p) => p.checked).map((p) => p.value as Preference);
    const result = await submitPreregistration({
      email: el<HTMLInputElement>('email').value.trim().toLowerCase(),
      password: pwInput.value,
      gender: (form.querySelector('input[name=gender]:checked') as HTMLInputElement).value as Gender,
      preferences,
      birthDate: parsed.iso,
      acceptedTerms: true,
      marketingOptIn: el<HTMLInputElement>('marketingOptIn').checked,
      website: el<HTMLInputElement>('website').value,
      source: readSource(),
      submittedAt: new Date().toISOString(),
    });

    submitting = false;
    next.disabled = false;
    next.classList.remove('is-loading');

    if (!result.ok) {
      nextLabel.textContent = 'Envoyer ma demande';
      setError(STEP_COUNT - 1, result.error);
      return;
    }
    // Ne garder aucune trace du mot de passe dans le DOM
    pwInput.value = '';
    el<HTMLInputElement>('passwordConfirm').value = '';
    demoNote.hidden = !result.demo;
    show(STEP_COUNT);
    rainHearts();
    hooks.onSuccess?.();
  }

  function rainHearts() {
    const box = document.getElementById('bdHearts')!;
    box.innerHTML = '';
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

  return { open };
}
