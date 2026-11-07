/**
 * Scène WebGL plein écran (fond transparent, page claire) :
 * - le logo K? de Kiess en 3D, extrudé depuis les tracés du fichier EPS officiel,
 *   matériau verni au dégradé de marque #ca2f72 → #fc2d3d ;
 * - un champ de petits cœurs 3D (iconographie de l'app) ;
 * - un halo rose doux.
 * La position du logo est pilotée par le scroll (setPose), son orientation par le pointeur.
 */
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MARK_PATHS, MARK_VIEWBOX } from '../logo';

export interface HeartPose {
  /** position horizontale en fraction de la largeur visible (-0.5 … 0.5) */
  x: number;
  /** position verticale en fraction de la hauteur visible (-0.5 … 0.5) */
  y: number;
  /** hauteur du logo en fraction de la hauteur visible */
  s: number;
  /** rotation Y additionnelle (radians) */
  r: number;
}

const MAGENTA = new THREE.Color('#ca2f72');
const RED = new THREE.Color('#fc2d3d');
const ROSE = new THREE.Color('#ff6aab');
// Teintes du matériau 3D légèrement plus profondes que la charte : l'éclairage
// les éclaircit, le rendu final retombe sur #ca2f72 → #fc2d3d.
const MAGENTA_3D = new THREE.Color('#b0215f');
const RED_3D = new THREE.Color('#e5162b');

/** Centre la géométrie et ramène sa hauteur à 1. */
function centerAndScale(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.computeBoundingBox();
  g.center();
  const size = new THREE.Vector3();
  g.computeBoundingBox();
  g.boundingBox!.getSize(size);
  const k = 1 / size.y;
  g.scale(k, k, k);
  g.computeBoundingBox();
  return g;
}

/** Logo K? extrudé, avec dégradé de marque en couleurs de sommets (haut-gauche magenta → bas-droite rouge). */
function logoGeometry(): THREE.BufferGeometry {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}">${MARK_PATHS.map((d) => `<path d="${d}"/>`).join('')}</svg>`;
  const data = new SVGLoader().parse(svg);
  const shapes = data.paths.flatMap((p) => p.toShapes());
  const g = new THREE.ExtrudeGeometry(shapes, {
    depth: 2.4,
    bevelEnabled: true,
    bevelThickness: 0.9,
    bevelSize: 0.42,
    // Le tracé main levée compte déjà beaucoup de petites courbes : 12 segments
    // par courbe et 6 pour le biseau suffisent (≈ 4× moins de sommets à calculer)
    bevelSegments: 6,
    curveSegments: 12,
  });
  // SVG = y vers le bas : une rotation de π autour de X remet le logo à l'endroit sans miroir
  g.rotateX(Math.PI);
  centerAndScale(g);

  const pos = g.getAttribute('position');
  const bb = g.boundingBox!;
  const w = bb.max.x - bb.min.x;
  const h = bb.max.y - bb.min.y;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const tx = (pos.getX(i) - bb.min.x) / w;
    const ty = (bb.max.y - pos.getY(i)) / h;
    const t = THREE.MathUtils.clamp(tx * 0.45 + ty * 0.55, 0, 1);
    c.lerpColors(MAGENTA_3D, RED_3D, t);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

function heartShapeGeometry(curveSegments: number, bevelSegments: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(5, 5);
  s.bezierCurveTo(5, 5, 4, 0, 0, 0);
  s.bezierCurveTo(-6, 0, -6, 7, -6, 7);
  s.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
  s.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
  s.bezierCurveTo(16, 7, 16, 0, 10, 0);
  s.bezierCurveTo(7, 0, 5, 5, 5, 5);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 3,
    bevelEnabled: true,
    bevelThickness: 3.2,
    bevelSize: 2.6,
    bevelSegments,
    curveSegments,
  });
  g.rotateZ(Math.PI);
  return centerAndScale(g);
}

function glowTexture(): THREE.Texture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(252,45,61,0.22)');
  g.addColorStop(0.4, 'rgba(202,47,114,0.10)');
  g.addColorStop(1, 'rgba(202,47,114,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Double battement, période 1,25 s (le logo « bat » comme un cœur). */
function heartbeat(t: number): number {
  const p = (t % 1.25) / 1.25;
  return Math.exp(-((p - 0.06) ** 2) / 0.0012) + 0.55 * Math.exp(-((p - 0.22) ** 2) / 0.0015);
}

const damp = (a: number, b: number, lambda: number, dt: number) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-lambda * dt));

export class KiessScene {
  private mobile: boolean;
  private building: Promise<void> | null = null;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private pivot = new THREE.Group();
  // Construits par étapes dans build() ; frame() ne tourne qu'après.
  private logo!: THREE.Mesh;
  private glow!: THREE.Sprite;
  private field!: THREE.InstancedMesh;
  private fieldData: { x: number; y: number; z: number; s: number; rx: number; ry: number; vr: number; ph: number }[] = [];
  private dummy = new THREE.Object3D();
  private timer = new THREE.Timer();
  private target: HeartPose = { x: 0.24, y: 0, s: 0.6, r: 0 };
  private pose: HeartPose = { x: 0.24, y: -0.6, s: 0.0, r: 0 };
  private pointer = new THREE.Vector2();
  private pointerSmooth = new THREE.Vector2();
  private scrollY = 0;
  private velocity = 0;
  private spinBoost = 0;
  private spinAngle = 0;
  private pulseBoost = 0;
  private fieldSpin = 0;
  private visH = 1;
  private visW = 1;
  /** Hauteur de fenêtre mémorisée au redimensionnement (pas de lecture à chaque image) */
  private viewH = window.innerHeight;
  private running = true;
  private reduced: boolean;

  constructor(canvas: HTMLCanvasElement, opts: { mobile: boolean; reducedMotion: boolean }) {
    this.reduced = opts.reducedMotion;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.mobile ? 1.75 : 2));
    // En production, pas de lecture synchrone des journaux de compilation (bloquante)
    this.renderer.debug.checkShaderErrors = import.meta.env.DEV;
    // Neutral (Khronos PBR) conserve les couleurs de marque sans les délaver
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 0.82;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    this.camera.position.set(0, 0, 8);

    // Éclairage sobre : le dégradé de marque doit rester saturé (pas de rendu « saumon »)
    const key = new THREE.DirectionalLight('#ffffff', 1.25);
    key.position.set(3, 4, 6);
    const rim = new THREE.PointLight('#ff3d8a', 28, 30);
    rim.position.set(-4, 3, -2);
    const fill = new THREE.PointLight('#ff2a40', 9, 20);
    fill.position.set(2.5, -3, 3);
    this.scene.add(key, rim, fill, new THREE.AmbientLight('#ffffff', 0.08));

    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('pointermove', (e) => {
      this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    });
    document.addEventListener('visibilitychange', () => {
      this.running = document.visibilityState === 'visible';
      if (this.running) this.timer.reset();
    });

    this.mobile = opts.mobile;
  }

  /**
   * Lance la construction de la scène (une seule fois). Appelée après l'intro :
   * le haut de page n'a pas besoin de la 3D pour s'afficher.
   */
  start(): Promise<void> {
    this.building ??= this.build(this.mobile);
    return this.building;
  }

  /**
   * Construction en plusieurs tâches courtes (une pause entre chaque étape) :
   * le navigateur reste réactif pendant le chargement au lieu de geler ~0,5 s.
   */
  private async build(mobile: boolean): Promise<void> {
    const pause = () => new Promise<void>((r) => setTimeout(r, 0));
    await pause();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    // Reflets doux (intensité 0,22 sur le logo) : une carte 128 px suffit et coûte 4× moins que 256
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04, 0.1, 100, { size: 128 }).texture;
    pmrem.dispose();
    await pause();

    // Logo K? 3D
    const logoMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.36,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      envMapIntensity: 0.22,
    });
    this.logo = new THREE.Mesh(logoGeometry(), logoMat);
    this.pivot.add(this.logo);

    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false }));
    this.glow.position.z = -1.4;
    this.pivot.add(this.glow);
    this.scene.add(this.pivot);
    await pause();

    // Champ de petits cœurs
    const count = mobile ? 14 : 30;
    const smallGeo = heartShapeGeometry(10, 3);
    const smallMat = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.05, envMapIntensity: 0.9 });
    this.field = new THREE.InstancedMesh(smallGeo, smallMat, count);
    const palette = [RED, MAGENTA, ROSE, new THREE.Color('#e3354c')];
    for (let i = 0; i < count; i++) {
      this.fieldData.push({
        x: (Math.random() - 0.5) * 1.5,
        y: (Math.random() - 0.5) * 2.4,
        z: -1.5 - Math.random() * 8,
        s: 0.06 + Math.random() * 0.13,
        rx: (Math.random() - 0.5) * 0.8,
        ry: (Math.random() - 0.5) * 1.2,
        vr: (Math.random() - 0.5) * 0.5,
        ph: Math.random() * Math.PI * 2,
      });
      this.field.setColorAt(i, palette[i % palette.length]);
    }
    this.scene.add(this.field);

    // Shaders compilés en parallèle (KHR_parallel_shader_compile) avant la
    // première image : sans ça, le premier rendu gèle la page le temps de la
    // compilation, en plein chargement.
    await this.renderer.compileAsync(this.scene, this.camera).catch(() => undefined);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.viewH = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.visH = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.visW = this.visH * this.camera.aspect;
  }

  setPose(p: HeartPose) {
    this.target = p;
  }

  setScroll(y: number, velocity: number) {
    this.scrollY = y;
    this.velocity = velocity;
  }

  /** Petit emballement : tour sur lui-même + battement plus fort (survol CTA, succès). */
  excite(amount = 1) {
    this.spinBoost = Math.min(this.spinBoost + 3 * amount, 7);
    this.pulseBoost = Math.min(this.pulseBoost + amount, 1.5);
  }

  private frame() {
    if (!this.running) return;
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    const t = this.timer.getElapsed();
    const motion = this.reduced ? 0.25 : 1;

    this.pose.x = damp(this.pose.x, this.target.x, 3.2, dt);
    this.pose.y = damp(this.pose.y, this.target.y, 3.2, dt);
    this.pose.s = damp(this.pose.s, this.target.s, 3.6, dt);
    this.pose.r = damp(this.pose.r, this.target.r, 3, dt);
    this.pointerSmooth.lerp(this.pointer, 1 - Math.exp(-4 * dt));
    this.spinBoost = damp(this.spinBoost, 0, 1.4, dt);
    this.pulseBoost = damp(this.pulseBoost, 0, 1.2, dt);

    // Logo : balancement doux (un logo plat se lit mal de profil), tour complet sur « excite »
    const beat = heartbeat(t) * (0.03 + 0.07 * this.pulseBoost) * motion;
    const scale = this.pose.s * this.visH * (1 + beat);
    this.pivot.visible = scale > 0.01;
    this.pivot.position.set(this.pose.x * this.visW, this.pose.y * this.visH + Math.sin(t * 1.1) * 0.06 * motion, 0);
    this.pivot.scale.setScalar(Math.max(scale, 0.0001));
    this.spinAngle += this.spinBoost * dt;
    const sway = Math.sin(t * 0.55) * 0.42 * motion + Math.abs(this.velocity) * 0.0015;
    this.logo.rotation.y = this.pose.r + sway + this.pointerSmooth.x * 0.5 + this.spinAngle;
    this.logo.rotation.x = damp(this.logo.rotation.x, -this.pointerSmooth.y * 0.32 + Math.sin(t * 0.7) * 0.05, 4, dt);
    this.logo.rotation.z = damp(this.logo.rotation.z, -this.pointerSmooth.x * 0.08, 4, dt);
    // une fois l'élan retombé, on ramène l'angle de tour au multiple de 2π le plus proche
    if (this.spinBoost < 0.05) this.spinAngle = damp(this.spinAngle, Math.round(this.spinAngle / (Math.PI * 2)) * Math.PI * 2, 2, dt);
    this.glow.scale.setScalar(2.4 + beat * 5);

    // Champ de cœurs : parallaxe au scroll + dérive
    this.fieldSpin += Math.min(Math.abs(this.velocity) * 0.004, 3) * dt;
    for (let i = 0; i < this.fieldData.length; i++) {
      const d = this.fieldData[i];
      const spread = (this.camera.position.z - d.z) / this.camera.position.z;
      const Hd = this.visH * 1.3 * spread;
      const scrollShift = ((this.scrollY / this.viewH) * this.visH * 0.45) / spread;
      let y = d.y * Hd + scrollShift + Math.sin(t * 0.4 + d.ph) * 0.15 * motion;
      y = ((((y + Hd / 2) % Hd) + Hd) % Hd) - Hd / 2;
      this.dummy.position.set(d.x * this.visW * spread + (this.pointerSmooth.x * 0.3) / spread, y, d.z);
      this.dummy.rotation.set(
        d.rx + Math.sin(t * 0.5 + d.ph) * 0.35 * motion,
        d.ry + Math.sin(t * d.vr + d.ph) * 0.9 * motion + this.fieldSpin * (0.5 + d.s * 4),
        Math.sin(t * 0.3 + d.ph) * 0.25,
      );
      this.dummy.scale.setScalar(d.s);
      this.dummy.updateMatrix();
      this.field.setMatrixAt(i, this.dummy.matrix);
    }
    this.field.instanceMatrix.needsUpdate = true;

    this.renderer.render(this.scene, this.camera);
  }
}
