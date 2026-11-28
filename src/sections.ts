import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { BADGES } from './badges';
import { svgLogo } from './logo';

gsap.registerPlugin(ScrollTrigger);

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// ─── Logos inline ────────────────────────────────────────────────────────
export function mountLogos() {
  document.querySelectorAll<HTMLElement>('[data-logo]').forEach((n) => {
    const kind = n.dataset.logo!;
    if (kind === 'wordmark-white') n.innerHTML = svgLogo('wordmark', '#fff');
    else if (kind === 'wordmark-gradient') n.innerHTML = svgLogo('wordmark', 'gradient');
    else if (kind === 'mark-white') n.innerHTML = svgLogo('mark', '#fff');
    else if (kind === 'mark-gradient') n.innerHTML = svgLogo('mark', 'gradient');
    else if (kind === 'mark-faint') n.innerHTML = svgLogo('mark', '#f1e4e8');
    else if (kind === 'mark-current') n.innerHTML = svgLogo('mark', 'currentColor');
    n.querySelector('svg')?.setAttribute('aria-hidden', 'true');
  });
}

// ─── Hero : maquette de l'écran de révélation ───────────────────────────
export function initHeroMockup(reduced: boolean) {
  const grid = document.getElementById('heroGrid')!;
  const mark = svgLogo('mark', '#fff');
  grid.innerHTML = Array.from({ length: 16 }, () => `<div class="tile"><div class="tile-face">${mark}</div></div>`).join('');
  const tiles = Array.from(grid.querySelectorAll<HTMLElement>('.tile'));

  // État de départ = maquette Figma (œil, joue, sourire déjà révélés)
  const base = [5, 8, 10, 11, 14];
  const extra = [9, 6, 13, 1, 4, 2, 7, 12];
  base.forEach((i) => gsap.set(tiles[i], { rotationY: 180 }));

  // Le téléphone se redresse et remonte quand on quitte le hero
  gsap.to('.hero-device-stage', {
    yPercent: -10,
    rotationX: 8,
    ease: 'none',
    scrollTrigger: { trigger: '#top', start: 'top top', end: 'bottom top', scrub: true },
  });

  if (reduced) return;
  const flip = (i: number, on: boolean) => {
    gsap.to(tiles[i], { rotationY: on ? 180 : 0, duration: 0.8, ease: 'power3.inOut' });
    gsap.fromTo(tiles[i], { z: 0 }, { z: 40, duration: 0.4, yoyo: true, repeat: 1, ease: 'sine.inOut' });
  };
  const tl = gsap.timeline({ repeat: -1, delay: 1.6, repeatDelay: 0.4 });
  extra.forEach((i, k) => tl.call(() => flip(i, true), [], k * 1.6));
  tl.call(() => extra.forEach((i) => flip(i, false)), [], extra.length * 1.6 + 1.8);
  tl.to({}, { duration: 1.2 });
  ScrollTrigger.create({
    trigger: '#top',
    start: 'top top',
    end: 'bottom top',
    onToggle: (self) => (self.isActive ? tl.resume() : tl.pause()),
  });
}

// ─── Manifeste : mots qui s'allument au scroll ──────────────────────────
export function initManifesto() {
  const p = document.getElementById('manifestoText')!;
  const words = p.textContent!.trim().split(/\s+/);
  // Texte complet pour les lecteurs d'écran, mots animés masqués pour eux
  // (aria-label n'est pas permis sur un paragraphe)
  const full = p.textContent!.trim();
  p.innerHTML =
    `<span class="sr-only">${full}</span>` +
    words.map((w) => `<span class="w" aria-hidden="true">${w}</span>`).join(' ');
  gsap.fromTo(
    p.querySelectorAll('.w'),
    { opacity: 0.16 },
    {
      opacity: 1,
      stagger: 0.12,
      ease: 'none',
      scrollTrigger: { trigger: p, start: 'top 78%', end: 'bottom 45%', scrub: true },
    },
  );
}

// ─── Film : la tuile vidéo s'ouvre au scroll ────────────────────────────
export function initFilm(video: HTMLVideoElement, reduced: boolean) {
  const card = document.getElementById('filmCard')!;
  gsap.fromTo(
    card,
    { scale: 0.84, borderRadius: 44 },
    { scale: 1, borderRadius: 20, ease: 'none', scrollTrigger: { trigger: '#film', start: 'top bottom', end: 'center center', scrub: true } },
  );
  gsap.fromTo(video, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: '#film', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.from('.film-caption > *', {
    y: 40,
    opacity: 0,
    stagger: 0.12,
    duration: 1,
    ease: 'power3.out',
    scrollTrigger: { trigger: card, start: 'top 60%' },
  });
  ScrollTrigger.create({
    trigger: card,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => {
      if (self.isActive && !reduced) video.play().catch(() => {});
      else video.pause();
    },
  });
}

// ─── Inclinaison 3D au pointeur ─────────────────────────────────────────
export function initTilt() {
  if (matchMedia('(hover: none)').matches) return;
  document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((stage) => {
    const max = Number(stage.dataset.tilt) || 10;
    const isStage = stage.classList.contains('tilt-stage');
    const target = isStage ? (stage.firstElementChild as HTMLElement) : stage;
    const glare = target.querySelector<HTMLElement>('.ticket-glare');
    // perspective propre à l'élément : pas de décalage des calques 3D au repos
    if (!isStage) gsap.set(target, { transformPerspective: 900 });
    const xTo = gsap.quickTo(target, 'rotationY', { duration: 0.6, ease: 'power3' });
    const yTo = gsap.quickTo(target, 'rotationX', { duration: 0.6, ease: 'power3' });
    stage.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      xTo(px * max * 2);
      yTo(-py * max * 2);
      if (glare) {
        glare.style.setProperty('--gx', `${(px + 0.5) * 100}%`);
        glare.style.setProperty('--gy', `${(py + 0.5) * 100}%`);
        glare.style.opacity = '1';
      }
    });
    stage.addEventListener('pointerleave', () => {
      xTo(0);
      yTo(0);
      if (glare) glare.style.opacity = '0';
    });
  });
}

// ─── 01 Matchmaking : l'iPhone de l'onglet Kiess se redresse au scroll ──
export function initMatchmaking() {
  gsap.fromTo(
    '#matchmaking .tilt-stage',
    { rotationX: 26, rotationY: -10, y: 40 },
    { rotationX: 4, rotationY: -4, y: 0, ease: 'none', scrollTrigger: { trigger: '#matchmaking', start: 'top bottom', end: 'center center', scrub: true } },
  );
}

// ─── 02 Slots : 3 discussions maximum ───────────────────────────────────
export function initSlots() {
  const slots = Array.from(document.querySelectorAll<HTMLElement>('#slotsBoard .slot:not(.slot-locked)'));
  const locked = document.querySelector<HTMLElement>('#slotsBoard .slot-locked')!;
  const count = document.getElementById('slotsCount')!;
  let filled = -1;

  // Glissés sans rebond, comme les animations de la nouvelle interface
  gsap.from('#slotsBoard .slot', {
    y: 40,
    opacity: 0,
    rotationX: -30,
    stagger: 0.08,
    duration: 0.8,
    ease: 'power3.out',
    scrollTrigger: { trigger: '#slotsBoard', start: 'top 80%' },
  });

  const render = (n: number) => {
    if (n === filled) return;
    slots.forEach((s, i) => {
      if (i === 0) return;
      const on = i < n;
      if (on === s.classList.contains('slot-full')) return;
      s.classList.toggle('slot-full', on);
      s.querySelector('.slot-name')!.textContent = on ? s.dataset.fill! : 'Vide';
      if (on) gsap.fromTo(s.querySelector('.slot-ring'), { scale: 0.88 }, { scale: 1, duration: 0.5, ease: 'power3.out' });
    });
    count.textContent = String(n);
    const full = n >= 3;
    locked.classList.toggle('slot-nope', full);
    if (full && filled < 3) gsap.fromTo(locked, { x: 0 }, { keyframes: { x: [0, -8, 7, -5, 3, 0] }, duration: 0.5, delay: 0.3 });
    filled = n;
  };
  render(1);
  ScrollTrigger.create({
    trigger: '#slots',
    start: 'top 55%',
    end: 'center 35%',
    onUpdate: (self) => render(1 + (self.progress > 0.3 ? 1 : 0) + (self.progress > 0.7 ? 1 : 0)),
  });
}

// ─── 03 Ticket ──────────────────────────────────────────────────────────
export function initTicket(onMatch: () => void) {
  const wave = document.getElementById('ticketWave')!;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const bars = 46;
  const waveBars = Array.from({ length: bars }, (_, i) => {
    const env = Math.sin((i / bars) * Math.PI) * 0.7 + 0.3;
    const h = Math.max(0.12, env * (0.35 + rnd() * 0.65));
    return { h: h.toFixed(2), d: `${(rnd() * 0.8).toFixed(2)}s` };
  });
  wave.innerHTML = '<i></i>'.repeat(bars);
  wave.querySelectorAll<HTMLElement>('i').forEach((el, i) => {
    el.style.setProperty('--h', waveBars[i].h);
    el.style.setProperty('--d', waveBars[i].d);
  });

  const badgeIds = ['cinema', 'jardinage', 'graffiti', 'vegetarien', 'jeux-papier', 'casino'];
  const grads = [
    ['#1F75BB', '#34A5DE'],
    ['#40AB34', '#8FBF20'],
    ['#662483', '#82368C'],
    ['#40AB34', '#8FBF20'],
    ['#1F75BB', '#34A5DE'],
    ['#662483', '#82368C'],
  ];
  const labels: Record<string, string> = { cinema: 'Cinéma', jardinage: 'Jardinage', graffiti: 'Street art', vegetarien: 'Végétarien', 'jeux-papier': 'Jeux de société', casino: 'Casino' };
  const badgesHost = document.getElementById('ticketBadges')!;
  // Six badges puis le reste en pastille, comme sur la carte de l'app
  badgesHost.innerHTML =
    badgeIds
      .map((id) => `<span class="badge" title="${labels[id]}">${BADGES[id] ?? ''}<span class="sr-only">${labels[id]}</span></span>`)
      .join('') + `<span class="badge-more">+${30 - badgeIds.length}<span class="sr-only"> autres badges</span></span>`;
  badgesHost.querySelectorAll<HTMLElement>('.badge').forEach((el, i) => {
    el.style.setProperty('--a', grads[i][1]);
    el.style.setProperty('--b', grads[i][0]);
  });

  const audio = document.getElementById('ticketAudio') as HTMLButtonElement;
  audio.addEventListener('click', () => {
    const on = audio.getAttribute('aria-pressed') !== 'true';
    audio.setAttribute('aria-pressed', String(on));
    audio.classList.toggle('playing', on);
  });

  // Recto : le pourcentage et l'anneau de compatibilité se remplissent ensemble
  const pct = document.querySelector<HTMLElement>('#pcardFront [data-count]')!;
  const ring = document.querySelector<SVGCircleElement>('#pcardFront .pc-ring-val')!;
  const o = { v: 0 };
  gsap.fromTo(
    '#ticket .tilt-stage',
    { rotationX: 38, rotationZ: -6, y: 80, opacity: 0.2 },
    { rotationX: 0, rotationZ: 0, y: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: '#ticket', start: 'top bottom', end: 'center 65%', scrub: true } },
  );
  ScrollTrigger.create({
    trigger: '#ticketCard',
    start: 'top 70%',
    once: true,
    onEnter: () => {
      gsap.to(o, {
        v: 87,
        duration: 1.4,
        ease: 'power3.out',
        onUpdate: () => {
          pct.textContent = String(Math.round(o.v));
          ring.style.setProperty('stroke-dashoffset', String(100 - o.v));
        },
      });
      audio.classList.add('playing');
      audio.setAttribute('aria-pressed', 'true');
    },
  });

  // Verso : détail du score, barres en largeur via le CSSOM (CSP sans style en ligne)
  document.querySelectorAll<HTMLElement>('#pcBars li').forEach((li) => {
    const v = Number(li.dataset.v);
    const max = Number(li.dataset.max);
    li.insertAdjacentHTML('beforeend', `<em>${v}<small>/${max}</small></em><i aria-hidden="true"></i>`);
    li.querySelector<HTMLElement>('i')!.style.setProperty('--w', `${(v / max) * 100}%`);
  });

  // Retourner la carte : glisser, toucher la carte ou bouton « Glisse pour retourner »
  const card = document.getElementById('ticketCard')!;
  const front = document.getElementById('pcardFront')!;
  const back = document.getElementById('pcardBack')!;
  back.inert = true;
  const flip = (focus = false) => {
    const flipped = card.classList.toggle('is-flipped');
    front.inert = flipped;
    back.inert = !flipped;
    front.setAttribute('aria-hidden', String(flipped));
    back.setAttribute('aria-hidden', String(!flipped));
    if (focus) (flipped ? back : front).querySelector<HTMLElement>('[data-flip]')?.focus({ preventScroll: true });
  };
  card.querySelectorAll<HTMLButtonElement>('[data-flip]').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      flip(e.detail === 0); // clavier : le focus suit la face visible
    }),
  );
  let startX = 0;
  let startY = 0;
  let tracking = false;
  card.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    tracking = true;
    startX = e.clientX;
    startY = e.clientY;
    card.classList.add('is-dragging');
    // Le relâchement revient à la carte même si le doigt en sort pendant le glissé
    card.setPointerCapture(e.pointerId);
  });
  const end = (e: PointerEvent) => {
    if (!tracking) return;
    tracking = false;
    card.classList.remove('is-dragging');
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    // Glissé horizontal franc, ou simple toucher
    if ((Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) || Math.hypot(dx, dy) < 6) flip();
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', () => {
    tracking = false;
    card.classList.remove('is-dragging');
  });

  const yes = document.getElementById('ticketYes') as HTMLButtonElement;
  const no = document.getElementById('ticketNo') as HTMLButtonElement;
  yes.addEventListener('click', () => {
    if (yes.classList.contains('sent')) return;
    yes.classList.add('sent');
    yes.textContent = 'Demande envoyée';
    burstHearts(yes);
    onMatch();
    window.setTimeout(() => {
      yes.classList.remove('sent');
      yes.textContent = 'Je match';
    }, 2600);
  });
  no.addEventListener('click', () => {
    gsap.to('#ticketCard', { keyframes: { x: [0, -14, 12, -8, 5, 0] }, duration: 0.5, ease: 'power1.out' });
  });
}

function burstHearts(from: HTMLElement) {
  const r = from.getBoundingClientRect();
  for (let i = 0; i < 12; i++) {
    const img = document.createElement('img');
    img.src = `/assets/coeur${(i % 5) + 1}.webp`;
    img.alt = '';
    img.className = 'burst-heart';
    img.style.left = `${r.left + r.width / 2}px`;
    img.style.top = `${r.top + r.height / 2}px`;
    document.body.appendChild(img);
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
    const dist = 110 + Math.random() * 160;
    gsap.fromTo(
      img,
      { x: '-50%', y: '-50%', scale: 0.2, rotation: 0, opacity: 1 },
      {
        x: `+=${Math.cos(angle) * dist}`,
        y: `+=${Math.sin(angle) * dist}`,
        scale: 0.5 + Math.random() * 0.7,
        rotation: (Math.random() - 0.5) * 80,
        opacity: 0,
        duration: 1.1 + Math.random() * 0.5,
        ease: 'power2.out',
        onComplete: () => img.remove(),
      },
    );
  }
}

// ─── 04 Chat : 1 point par échange de messages, 2 par échange de vocaux ─
export function initChat() {
  const section = document.getElementById('chat')!;
  const msgs = Array.from(section.querySelectorAll<HTMLElement>('.msg'));
  const unlock = document.getElementById('chatUnlock')!;
  const ptsVal = document.getElementById('ptsVal')!;
  const chip = document.getElementById('ptsChip')!;
  const base = 12;
  let shown = -1;

  // Les points tombent sur la réponse qui complète l'échange (data-pts)
  const fly = (msg: HTMLElement, pts: number) => {
    const tag = document.createElement('span');
    tag.className = 'pts-fly';
    tag.textContent = `+${pts}`;
    msg.appendChild(tag);
    const mr = msg.getBoundingClientRect();
    const cr = chip.getBoundingClientRect();
    gsap.fromTo(
      tag,
      { x: 0, y: 0, opacity: 0, scale: 0.6 },
      {
        keyframes: [
          { opacity: 1, scale: 1.15, y: -14, duration: 0.3 },
          { x: cr.left + cr.width / 2 - (mr.left + mr.width / 2), y: cr.top - mr.top, scale: 0.6, opacity: 0, duration: 0.6, ease: 'power2.in' },
        ],
        onComplete: () => {
          tag.remove();
          gsap.fromTo(chip, { scale: 1.2 }, { scale: 1, duration: 0.45, ease: 'power3.out' });
        },
      },
    );
  };

  const render = (n: number, animate: boolean) => {
    msgs.forEach((m, i) => m.classList.toggle('in', i <= n));
    let total = base;
    msgs.forEach((m, i) => {
      if (i <= n) total += Number(m.dataset.pts ?? 0);
    });
    unlock.classList.toggle('in', n >= msgs.length - 1);
    const delta = n >= 0 ? Number(msgs[n].dataset.pts ?? 0) : 0;
    if (animate && n > shown && delta > 0) {
      fly(msgs[n], delta);
      window.setTimeout(() => (ptsVal.textContent = String(total)), 750);
    } else {
      ptsVal.textContent = String(total);
    }
    shown = n;
  };
  render(-1, false);

  const update = (p: number) => {
    const n = Math.min(msgs.length - 1, Math.floor((p - 0.04) / 0.135));
    if (n !== shown) render(n, true);
  };
  ScrollTrigger.create({
    trigger: section.querySelector('.sticky-visual'),
    start: 'top 45%',
    end: 'bottom bottom',
    onUpdate: (self) => update(self.progress),
    onRefresh: (self) => update(self.progress),
  });
}

// ─── 05 Révélation ──────────────────────────────────────────────────────
export function initReveal(opts: { scrubVideo: boolean }) {
  const section = document.getElementById('revelation')!;
  const tilesHost = document.getElementById('revealTiles')!;
  const video = document.getElementById('revealVideo') as HTMLVideoElement;
  const steps = Array.from(document.querySelectorAll<HTMLElement>('#revealSteps li'));
  const idCard = document.getElementById('revealId')!;
  const rsVocals = document.getElementById('rsVocals')!;
  const rsTiles = document.getElementById('rsTiles')!;
  const rsMsgs = document.getElementById('rsMsgs')!;

  const mark = svgLogo('mark', '#fff');
  tilesHost.innerHTML = Array.from({ length: 16 }, () => `<div class="tile"><div class="tile-face">${mark}</div></div>`).join('');
  const tiles = Array.from(tilesHost.querySelectorAll<HTMLElement>('.tile'));

  // Ordre de révélation : yeux et sourire d'abord, puis le reste
  const order = [5, 10, 6, 9, 13, 1, 2, 14, 4, 7, 0, 11, 8, 3, 12, 15];
  let revealed = 0;

  video.src = '/media/reveal.mp4';
  video.load();
  if (!opts.scrubVideo) {
    video.loop = true;
    ScrollTrigger.create({
      trigger: section,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => (self.isActive ? video.play().catch(() => {}) : video.pause()),
    });
  }

  let pendingSeek: number | null = null;
  video.addEventListener('seeked', () => {
    if (pendingSeek !== null) {
      const t = pendingSeek;
      pendingSeek = null;
      video.currentTime = t;
    }
  });
  const seek = (t: number) => {
    if (!video.duration || Math.abs(video.currentTime - t) < 0.04) return;
    if (video.seeking) pendingSeek = t;
    else video.currentTime = t;
  };

  const setCount = (n: number) => {
    n = Math.max(0, Math.min(16, n));
    if (n === revealed) return;
    for (let i = 0; i < 16; i++) {
      const tile = tiles[order[i]];
      const on = i < n;
      if (on !== tile.classList.contains('flipped')) {
        tile.classList.toggle('flipped', on);
        const delay = on ? Math.max(0, i - revealed) * 0.05 : 0;
        gsap.to(tile, { rotationY: on ? 180 : 0, duration: 0.75, ease: 'power3.inOut', delay, overwrite: 'auto' });
        gsap.fromTo(tile, { z: 0 }, { z: 70, duration: 0.375, yoyo: true, repeat: 1, ease: 'sine.inOut', delay });
      }
    }
    revealed = n;
    rsTiles.textContent = String(n);
  };

  const update = (p: number) => {
    const q = clamp01((p - 0.04) / 0.8);
    setCount(Math.floor(q * 16.999));
    rsMsgs.textContent = String(Math.round(q * 210));
    rsVocals.textContent = String(Math.round(q * 18));
    const step = q < 0.34 ? 0 : q < 0.92 ? 1 : 2;
    steps.forEach((s, i) => s.classList.toggle('is-active', i === step));
    idCard.classList.toggle('in', p > 0.86);
    if (opts.scrubVideo && video.duration) seek(Math.min(video.duration - 0.05, p * video.duration));
  };
  ScrollTrigger.create({
    trigger: section.querySelector('.sticky-visual'),
    start: 'top 30%',
    end: 'bottom bottom',
    onUpdate: (self) => update(self.progress),
    onRefresh: (self) => update(self.progress),
  });

  gsap.fromTo('#revealBoard', { rotationX: 22, rotationY: -14 }, { rotationX: 0, rotationY: 0, ease: 'none', scrollTrigger: { trigger: section, start: 'top bottom', end: 'top top', scrub: true } });
}

// ─── 06 Jeux : éventail de cartes ───────────────────────────────────────
export function initGames() {
  const fan = document.getElementById('cardsFan')!;
  const cards = gsap.utils.toArray<HTMLElement>('#cardsFan .gcard');
  // Mobile : grille 2 × 2 (CSS), simple apparition
  if (matchMedia('(max-width: 820px)').matches) {
    gsap.from(cards, { y: 30, opacity: 0, stagger: 0.08, duration: 0.7, ease: 'power3.out', scrollTrigger: { trigger: fan, start: 'top 85%' } });
    return;
  }
  // Éventail centré, assez ouvert pour que chaque nom de jeu reste lisible
  // (il déborde un peu de sa colonne ; réduit en CSS sur les écrans moyens)
  const mid = (cards.length - 1) / 2;
  const spread = 145;
  gsap.fromTo(
    cards,
    { rotation: 0, x: 0, y: 40, rotationY: 0 },
    {
      rotation: (i) => (i - mid) * 9,
      x: (i) => (i - mid) * spread,
      y: (i) => Math.abs(i - mid) * 20,
      rotationY: (i) => (i - mid) * -8,
      ease: 'none',
      scrollTrigger: { trigger: '#jeux', start: 'top 85%', end: 'center 55%', scrub: true },
    },
  );
}

// ─── Interrupteur clair / sombre des maquettes de l'app ─────────────────
export function initAppTheme() {
  const btn = document.getElementById('appTheme') as HTMLButtonElement;
  const root = document.documentElement;
  let timer = 0;
  btn.addEventListener('click', () => {
    const dark = btn.getAttribute('aria-checked') !== 'true';
    btn.setAttribute('aria-checked', String(dark));
    root.classList.add('app-theme-anim');
    if (dark) root.dataset.appTheme = 'dark';
    else delete root.dataset.appTheme;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => root.classList.remove('app-theme-anim'), 450);
  });
}

// ─── Curseur ────────────────────────────────────────────────────────────
export function initCursor() {
  if (matchMedia('(hover: none)').matches || matchMedia('(pointer: coarse)').matches) return;
  const c = document.getElementById('cursor')!;
  document.documentElement.classList.add('has-cursor');
  const xTo = gsap.quickTo(c, 'x', { duration: 0.35, ease: 'power3' });
  const yTo = gsap.quickTo(c, 'y', { duration: 0.35, ease: 'power3' });
  window.addEventListener('pointermove', (e) => {
    xTo(e.clientX);
    yTo(e.clientY);
  });
  document.addEventListener('pointerover', (e) => {
    const hot = (e.target as HTMLElement).closest('a, button, label, summary, [data-tilt]');
    c.classList.toggle('hot', !!hot);
  });
  document.addEventListener('pointerleave', () => c.classList.add('gone'));
  document.addEventListener('pointerenter', () => c.classList.remove('gone'));
}
