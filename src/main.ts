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
import { KiessScene, type HeartPose } from './three/scene';
import { initBetaForm } from './beta/form';
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

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = matchMedia('(max-width: 820px)').matches || matchMedia('(pointer: coarse)').matches;
const narrow = () => window.innerWidth <= 820;

// ─── Liens de configuration ─────────────────────────────────────────────
document.querySelectorAll<HTMLAnchorElement>('[data-cgu-link]').forEach((a) => (a.href = CONFIG.cguUrl));
document.querySelectorAll<HTMLAnchorElement>('[data-privacy-link]').forEach((a) => (a.href = CONFIG.privacyUrl));
document.querySelectorAll<HTMLAnchorElement>('[data-support-link]').forEach((a) => (a.href = `mailto:${CONFIG.supportEmail}`));
document.getElementById('year')!.textContent = String(new Date().getFullYear());

mountLogos();

// ─── Défilement fluide ──────────────────────────────────────────────────
let velocity = 0;
const lenis = reducedMotion ? null : new Lenis({ lerp: 0.1, wheelMultiplier: 0.9, touchMultiplier: 1.2 });
if (lenis) {
  lenis.on('scroll', (e: { velocity: number }) => {
    velocity = e.velocity;
    ScrollTrigger.update();
  });
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
} else {
  let last = window.scrollY;
  window.addEventListener('scroll', () => {
    velocity = window.scrollY - last;
    last = window.scrollY;
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
let scene: KiessScene | null = null;
try {
  scene = new KiessScene(document.getElementById('gl') as HTMLCanvasElement, { mobile: isMobile, reducedMotion });
  if (import.meta.env.DEV) (window as unknown as { __kiess: unknown }).__kiess = scene;
} catch (err) {
  console.warn('[Kiess] WebGL indisponible', err);
  document.documentElement.classList.add('no-webgl');
}

// Ancres de pose : chaque section porte data-heart="x,y,taille,rotation"
type Anchor = { el: HTMLElement; desk: HeartPose; mob: HeartPose };
const parsePose = (s: string): HeartPose => {
  const [x, y, sc, r] = s.split(',').map(Number);
  return { x, y, s: sc, r };
};
const anchors: Anchor[] = Array.from(document.querySelectorAll<HTMLElement>('[data-heart]')).map((el) => ({
  el,
  desk: parsePose(el.dataset.heart!),
  mob: parsePose(el.dataset.heartM ?? el.dataset.heart!),
}));
const smooth = (t: number) => t * t * (3 - 2 * t);

function poseFromScroll(): HeartPose {
  const vc = window.innerHeight / 2;
  const centers = anchors.map((a) => {
    const r = a.el.getBoundingClientRect();
    // pour les sections hautes (sticky), le centre « utile » est leur premier écran
    const h = Math.min(r.height, window.innerHeight * 1.2);
    return r.top + h / 2;
  });
  const pick = (a: Anchor) => (narrow() ? a.mob : a.desk);
  if (vc <= centers[0]) return pick(anchors[0]);
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = centers[i];
    const b = centers[i + 1];
    // la section i occupe l'écran jusqu'à son bas (cas sticky)
    const rA = anchors[i].el.getBoundingClientRect();
    const holdEnd = Math.max(a, rA.bottom - window.innerHeight / 2);
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
  const y = lenis ? lenis.scroll : window.scrollY;
  nav.classList.toggle('scrolled', y > 40);
  if (scene) {
    scene.setScroll(y, velocity);
    scene.setPose(poseFromScroll());
  }
  velocity *= 0.92;
});

// ─── Sections ───────────────────────────────────────────────────────────
initHeroMockup(reducedMotion);
initFilm(heroVideo, reducedMotion);
initManifesto();
initRadar();
initSlots();
initTicket(() => scene?.excite(1));
initChat();
initReveal({ scrubVideo: !isMobile && !reducedMotion });
initGames();
initTilt();
initMarquee(() => velocity);
initCursor();

document.querySelectorAll<HTMLElement>('[data-open-beta]').forEach((b) =>
  b.addEventListener('pointerenter', () => scene?.excite(0.35)),
);

initBetaForm({
  onOpen: () => lenis?.stop(),
  onClose: () => lenis?.start(),
  onSuccess: () => scene?.excite(1.4),
});

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
const assets = Promise.all([scene?.ready ?? Promise.resolve(), fontsReady]);
const timeout = new Promise((r) => setTimeout(r, 3500));

gsap.to(progress, { v: 85, duration: 2.2, ease: 'power2.out', onUpdate: () => setPct(progress.v) });

Promise.race([assets, timeout]).then(() => {
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
  document.documentElement.classList.add('is-ready');
}

// Recalcul après chargement des médias (hauteurs définitives)
window.addEventListener('load', () => ScrollTrigger.refresh());
