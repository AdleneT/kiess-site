import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/700.css';
import '@fontsource/roboto/900.css';
import '@fontsource/roboto/900-italic.css';
import './style.css';

import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CONFIG } from './config';
import type { HeartPose, KiessScene } from './three/scene';
import { initSignup } from './signup/flow';
import { consumeOAuthReturn } from './signup/oauth';
import {
  mountLogos,
  initManifesto,
  initTilt,
  initRadar,
  initFilm,
  initHeroMockup,
  initSlots,
  initTicket,
  initChat,
  initReveal,
  initGames,
  initMarquee,
  initCursor,
} from './sections';

// Retour d'une connexion Apple / Google / Facebook / Discord : lu (et retiré de
// l'adresse) avant toute autre chose.
const oauthReturn = consumeOAuthReturn();

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = matchMedia('(max-width: 820px)').matches || matchMedia('(pointer: coarse)').matches;
// Largeur mémorisée (mise à jour au redimensionnement) : lue à chaque image
let isNarrow = window.innerWidth <= 820;
window.addEventListener('resize', () => (isNarrow = window.innerWidth <= 820), { passive: true });
const narrow = () => isNarrow;

// ─── Liens de configuration ─────────────────────────────────────────────
document.querySelectorAll<HTMLAnchorElement>('[data-support-link]').forEach((a) => (a.href = `mailto:${CONFIG.supportEmail}`));
document.getElementById('year')!.textContent = String(new Date().getFullYear());

mountLogos();

// ─── Défilement fluide ──────────────────────────────────────────────────
let velocity = 0;
// Position de défilement tenue à jour par Lenis ou par l'événement scroll :
// lire window.scrollY à chaque image forcerait un recalcul de la mise en page.
let nativeScroll = window.scrollY;
const lenis = reducedMotion ? null : new Lenis({ lerp: 0.1, wheelMultiplier: 0.9, touchMultiplier: 1.2 });
if (lenis) {
  lenis.on('scroll', (e: { velocity: number }) => {
    velocity = e.velocity;
    ScrollTrigger.update();
  });
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
} else {
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    velocity = y - nativeScroll;
    nativeScroll = y;
  }, { passive: true });
}

document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) =>
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href')!;
    const target = id === '#top' ? document.body : document.querySelector<HTMLElement>(id);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(id === '#top' ? 0 : target, { offset: id === '#top' ? 0 : -20, duration: 1.4 });
    else target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  }),
);

// ─── Scène 3D ───────────────────────────────────────────────────────────
// Le moteur 3D (three.js, l'essentiel du poids JavaScript) est un fichier à
// part, téléchargé pendant l'intro : le haut de page n'en dépend pas et
// s'affiche plus vite. La scène est construite une fois l'intro jouée.
let scene: KiessScene | null = null;
let sceneModule: Promise<typeof import('./three/scene')> | null = null;
const loadSceneModule = () => (sceneModule ??= import('./three/scene'));

async function startScene() {
  try {
    const { KiessScene } = await loadSceneModule();
    scene = new KiessScene(document.getElementById('gl') as HTMLCanvasElement, { mobile: isMobile, reducedMotion });
    if (import.meta.env.DEV) (window as unknown as { __kiess: unknown }).__kiess = scene;
    await scene.start();
    document.documentElement.classList.add('gl-ready');
  } catch (err) {
    console.warn('[Kiess] WebGL indisponible', err);
    document.documentElement.classList.add('no-webgl');
  }
}

// Ancres de pose : chaque section porte data-heart="x,y,taille,rotation"
// top / height : position dans le document, mesurée seulement quand la mise en
// page change (et non à chaque image : lire getBoundingClientRect pendant que
// GSAP anime force un recalcul complet de la page, 60 fois par seconde).
type Anchor = { el: HTMLElement; desk: HeartPose; mob: HeartPose; top: number; height: number };
const parsePose = (s: string): HeartPose => {
  const [x, y, sc, r] = s.split(',').map(Number);
  return { x, y, s: sc, r };
};
const anchors: Anchor[] = Array.from(document.querySelectorAll<HTMLElement>('[data-heart]')).map((el) => ({
  el,
  desk: parsePose(el.dataset.heart!),
  mob: parsePose(el.dataset.heartM ?? el.dataset.heart!),
  top: 0,
  height: 0,
}));
const smooth = (t: number) => t * t * (3 - 2 * t);

let viewH = window.innerHeight;
function measureAnchors() {
  const sy = window.scrollY;
  viewH = window.innerHeight;
  for (const a of anchors) {
    const r = a.el.getBoundingClientRect();
    a.top = r.top + sy;
    a.height = r.height;
  }
}
measureAnchors();
ScrollTrigger.addEventListener('refresh', measureAnchors);
new ResizeObserver(() => measureAnchors()).observe(document.body);

function poseFromScroll(scrollY: number): HeartPose {
  // Tout en coordonnées document : centre de l'écran, centres des sections
  const vc = scrollY + viewH / 2;
  const centers = anchors.map((a) => {
    // pour les sections hautes (sticky), le centre « utile » est leur premier écran
    const h = Math.min(a.height, viewH * 1.2);
    return a.top + h / 2;
  });
  const pick = (a: Anchor) => (narrow() ? a.mob : a.desk);
  if (vc <= centers[0]) return pick(anchors[0]);
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = centers[i];
    const b = centers[i + 1];
    // la section i occupe l'écran jusqu'à son bas (cas sticky)
    const holdEnd = Math.max(a, anchors[i].top + anchors[i].height - viewH / 2);
    if (vc >= a && vc < b) {
      if (vc <= holdEnd) return pick(anchors[i]);
      const t = smooth(Math.min(1, (vc - holdEnd) / Math.max(1, b - holdEnd)));
      const p = pick(anchors[i]);
      const q = pick(anchors[i + 1]);
      return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, s: p.s + (q.s - p.s) * t, r: p.r + (q.r - p.r) * t };
    }
  }
  return pick(anchors[anchors.length - 1]);
}

// ─── Vidéo de la tuile « film » ─────────────────────────────────────────
const heroVideo = document.getElementById('heroVideo') as HTMLVideoElement;
heroVideo.src = narrow() ? '/media/hero-mobile.mp4' : '/media/hero.mp4';

// ─── Boucle de synchro scroll → 3D / nav ────────────────────────────────
const nav = document.getElementById('nav')!;
gsap.ticker.add(() => {
  const y = lenis ? lenis.scroll : nativeScroll;
  nav.classList.toggle('scrolled', y > 40);
  if (scene) {
    scene.setScroll(y, velocity);
    scene.setPose(poseFromScroll(y));
  }
  velocity *= 0.92;
});

// ─── Sections ───────────────────────────────────────────────────────────
// Initialisées une par une avec une pause entre chaque : plusieurs tâches
// courtes au lieu d'une longue, le navigateur reste réactif au chargement.
const pause = () => new Promise<void>((r) => setTimeout(r, 0));
const sectionsReady = (async () => {
  const steps: (() => void)[] = [
    () => initHeroMockup(reducedMotion),
    () => initFilm(heroVideo, reducedMotion),
    initManifesto,
    initRadar,
    initSlots,
    () => initTicket(() => scene?.excite(1)),
    initChat,
    () => initReveal({ scrubVideo: !isMobile && !reducedMotion }),
    initGames,
    initTilt,
    () => initMarquee(() => velocity),
    initCursor,
  ];
  for (const step of steps) {
    step();
    await pause();
  }
})();

document.querySelectorAll<HTMLElement>('[data-open-signup]').forEach((b) =>
  b.addEventListener('pointerenter', () => scene?.excite(0.35)),
);

const signup = initSignup({
  onOpen: () => lenis?.stop(),
  onClose: () => lenis?.start(),
  onSuccess: () => scene?.excite(1.4),
});
if (oauthReturn) void signup.resumeOAuth(oauthReturn);

// ─── Chargement + intro ─────────────────────────────────────────────────
const loader = document.getElementById('loader')!;
const pctEl = document.getElementById('loaderPct')!;
const fill = loader.querySelector<HTMLElement>('.loader-mark-fill')!;
const progress = { v: 0 };
const setPct = (v: number) => {
  pctEl.textContent = String(Math.round(v));
  fill.style.clipPath = `inset(${100 - v}% 0 0 0)`;
};

const fontsReady = document.fonts?.ready ?? Promise.resolve();
// Le haut de page (titre + iPhone) n'utilise pas la 3D : on n'attend que les
// polices (hébergées sur le site), avec un court minimum pour une transition propre.
const minLoader = new Promise((r) => setTimeout(r, 600));
const assets = Promise.all([fontsReady, minLoader]);
const timeout = new Promise((r) => setTimeout(r, 2500));

gsap.to(progress, { v: 85, duration: 2.2, ease: 'power2.out', onUpdate: () => setPct(progress.v) });

Promise.race([assets, timeout])
  .then(() => sectionsReady)
  .then(() => {
  gsap.killTweensOf(progress);
  gsap.to(progress, {
    v: 100,
    duration: 0.45,
    ease: 'power2.inOut',
    onUpdate: () => setPct(progress.v),
    onComplete: intro,
  });
});

function intro() {
  ScrollTrigger.refresh();
  const tl = gsap.timeline();
  tl.to(loader, { clipPath: 'circle(0% at 50% 50%)', duration: 0.9, ease: 'power3.inOut' })
    .set(loader, { display: 'none' })
    .from('.hero-title .hero-reveal', { yPercent: 110, duration: 1.1, stagger: 0.09, ease: 'power4.out' }, '-=0.35')
    .from(['.hero .eyebrow', '.hero-lead', '.hero-ctas', '.hero-meta'], { y: 24, opacity: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out' }, '-=0.8')
    .from('.nav', { y: -30, opacity: 0, duration: 0.8, ease: 'power3.out' }, '-=0.9')
    .from('.hero-device-tilt', { y: 140, opacity: 0, rotationY: -40, rotationX: 20, duration: 1.4, ease: 'power3.out' }, '-=1.1')
    .from('.sticker', { scale: 0, opacity: 0, duration: 0.7, stagger: 0.08, ease: 'back.out(2)' }, '-=0.7');
  // Moteur 3D téléchargé pendant l'intro, scène construite à la fin puis affichée en fondu
  void loadSceneModule();
  tl.call(() => void startScene());
  document.documentElement.classList.add('is-ready');
}

// Recalcul après chargement des médias (hauteurs définitives)
window.addEventListener('load', () => ScrollTrigger.refresh());
