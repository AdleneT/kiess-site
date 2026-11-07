# Kiess — site vitrine & inscription

Site statique (Vite + TypeScript + Three.js + GSAP + Lenis) en français : page d’accueil,
conditions générales, politique de confidentialité, mentions légales, page 404.

**L’inscription du site est celle de l’app.** Même parcours (`mobile/screens/onboarding`),
mêmes règles, mêmes routes de l’API Kiess : un compte créé sur le site est un compte de l’app,
dans lequel on se connecte ensuite directement (Apple, Google, Facebook, Discord, ou e-mail /
pseudo + mot de passe).

```
accueil : conditions + façon de s’inscrire
  ├─ Apple · Google · Facebook · Discord ─────────────┐
  └─ numéro de téléphone → code SMS ──────────────────┤
e-mail → prénom → nom → pseudo → genre → date de naissance → ville → mot de passe → photo
→ POST /auth/complete-signup → « Bravo ! »            (compte déjà complet → « Déjà inscrit·e »)
```

## Lancer

```bash
cd web
npm install
npm run dev        # http://localhost:5173 (sans VITE_API_URL : mode démo, aucun compte créé)
npm run build      # typecheck + build → dist/
npm run preview    # sert dist/ avec les mêmes en-têtes de sécurité qu’en production
```

Node 20+ (testé avec Node 24). Pour tester avec une vraie API en local : lancer `api/`
(`NODE_ENV=development`, `CORS_ORIGINS=http://localhost:5173`) et mettre
`VITE_API_URL=http://localhost:3000`. En développement, un fournisseur sans identifiant
passe par les jetons de test de l’API (`dev_token_…`), et le code SMS s’affiche sous le champ.

## Variables d’environnement

Copier `.env.example` en `.env`. Les variables `VITE_*` sont injectées **au build**.

| Clé | Rôle |
| --- | --- |
| `VITE_SITE_URL` | Adresse publique du site (défaut `https://kiess.fr`) : canonical, Open Graph, sitemap. |
| `VITE_API_URL` | **Obligatoire en production.** Adresse de l’API Kiess (la même que l’app). Ajoutée à la CSP (`connect-src`). |
| `VITE_UPLOADS_ORIGIN` | Origine des URL présignées S3 / R2 des photos (ex. `https://<compte>.r2.cloudflarestorage.com`). Ajoutée à la CSP. |
| `VITE_GOOGLE_CLIENT_ID` | ID client OAuth Google « Application Web ». Vide : bouton masqué. |
| `VITE_APPLE_SERVICES_ID` | Services ID « Sign in with Apple » du site. Vide : bouton masqué. |
| `VITE_FACEBOOK_APP_ID` | ID de l’application Meta (la même que l’app). Vide : bouton masqué. |
| `VITE_DISCORD_CLIENT_ID` | Client ID de l’application Discord. Vide : bouton masqué. |

## Connexions sociales

Sans script tiers (la CSP reste `script-src 'self'`) : la page part chez le fournisseur et revient
sur l’accueil (`src/signup/oauth.ts`). `state` (anti-CSRF) et `nonce` vérifiés au retour, réponse
retirée de l’adresse aussitôt lue, puis envoyée à l’API qui la vérifie :

| Fournisseur | Retour | Route API | Réglages API |
| --- | --- | --- | --- |
| Google | `id_token` | `POST /auth/google` | ajouter le client web à `GOOGLE_CLIENT_IDS` |
| Apple | `id_token` | `POST /auth/apple` | ajouter le Services ID à `APPLE_CLIENT_IDS` |
| Facebook | jeton d’accès | `POST /auth/facebook` | `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` (même app) |
| Discord | `code` | `POST /auth/discord` | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URIS` |

Adresse de retour à déclarer chez chaque fournisseur : **`https://kiess.fr/`** (l’accueil), et
`http://localhost:5173/` pour le développement. Apple exige aussi la vérification du domaine.

Le compte est retrouvé par fournisseur + identifiant : se connecter avec Google sur le site puis
dans l’app ouvre le même compte, même si l’adresse saisie à l’inscription est différente.

## Mise en ligne

1. **API** — l’API Kiess doit être en ligne (`render.yaml`), avec `CORS_ORIGINS` contenant
   `https://kiess.fr` et les réglages des fournisseurs ci-dessus.
2. **Build** — renseigner `.env` (au minimum `VITE_API_URL`), puis `npm run build`.
3. **Hostinger** — envoyer le **contenu** de `dist/` dans `public_html` (avec le fichier caché
   `.htaccess`, généré par le build depuis `htaccess.ts`). Ni base de données ni PHP : le site est
   entièrement statique.
4. **SSL** — hPanel → Sécurité → SSL : certificat actif. Le `.htaccess` force déjà le HTTPS.
5. **Référencement** — déclarer `https://kiess.fr/sitemap.xml` dans Google Search Console.

## Pages légales

`/cgu/` et `/confidentialite/` affichent **les textes de l’app**, générés au build depuis
[`api/src/legal/legal-content.ts`](../api/src/legal/legal-content.ts) (`legal.ts`) : modifier ce
fichier (et sa copie `mobile/legal/index.ts`), jamais les pages. La politique ajoute une section
propre au site (connexion sociale, session temporaire, aucun cookie). **Les champs surlignés en
jaune** (éditeur, adresse, SIRET, directeur de la publication, hébergeur de l’API, tribunal)
**sont à compléter avant la mise en ligne.**

## SEO, sécurité, données

- **SEO** : title / description, canonical, Open Graph + Twitter (`og-kiess.jpg` 1200×630),
  favicons (ico, svg, apple-touch), données structurées Organization / WebSite / FAQPage
  générées depuis la FAQ visible, `robots.txt` et `sitemap.xml` générés au build
  (plugin `kiess-seo` de `vite.config.ts`), page 404 en `noindex`.
- **En-têtes** (`htaccess.ts` → `dist/.htaccess`, repris par `npm run preview`) : CSP stricte
  (aucun script ni style en ligne ; `connect-src` = le site, l’API et le stockage des photos),
  HSTS, X-Frame-Options, nosniff, `Referrer-Policy: strict-origin`, Permissions-Policy, COOP ;
  HTTPS forcé, `www` redirigé, fichiers techniques bloqués. Pas de `style="…"` ni de
  `<script>` en ligne dans le code : passer par `element.style.setProperty()`.
- **Données** : aucun cookie, traceur ni service tiers (polices et médias auto-hébergés). Pendant
  l’inscription, les jetons de session sont gardés dans `sessionStorage` (onglet courant), puis
  révoqués (`/auth/logout`) et effacés à la fin. La photo est recadrée et réencodée en JPEG dans
  le navigateur (métadonnées EXIF / GPS supprimées) avant l’envoi.

## Performance

- three.js est chargé à part (`import()` dynamique) pendant l'intro ; la scène 3D est
  construite en plusieurs tâches courtes après l'intro puis affichée en fondu : le haut de
  page (titre + iPhone) n'attend pas la 3D.
- Aucune lecture de mise en page à chaque image (`getBoundingClientRect`, `scrollY`,
  `innerWidth`, `scrollWidth`) : positions mesurées au redimensionnement uniquement.
- Shaders compilés en parallèle (`compileAsync`), `checkShaderErrors` désactivé en production.

## Structure

```
web/
├── index.html              Accueil : contenu de toutes les sections + inscription (dialog)
├── cgu/                    Conditions générales (texte de l’app, généré)
├── confidentialite/        Politique de confidentialité (texte de l’app + section site)
├── mentions-legales/       Mentions légales
├── 404.html                Page introuvable
├── htaccess.ts             .htaccess (Hostinger) et en-têtes de sécurité
├── legal.ts                Pages légales générées depuis api/src/legal/legal-content.ts
├── public/
│   ├── media/              Médias optimisés (générés avec Higgsfield)
│   └── assets/             Logos, cœurs et pièces repris de mobile/assets/figma
├── media-src/              Fiches des générations Higgsfield (prompts, ids) ; rushes bruts ignorés par git
└── src/
    ├── main.ts             Orchestration : Lenis, chargement, trajet du logo 3D au scroll, intro
    ├── three/scene.ts      Scène WebGL (chargée à part) : logo K? 3D extrudé depuis l'EPS, petits cœurs, halo
    ├── sections.ts         Film, radar, slots, ticket, chat, grille de révélation, jeux, curseur…
    ├── signup/flow.ts      Parcours d’inscription (étapes de l’app, erreurs, photo)
    ├── signup/api.ts       Routes de l’API Kiess (seul fichier qui parle à l’API)
    ├── signup/oauth.ts     Apple / Google / Facebook / Discord (redirection, state, nonce)
    ├── signup/photo.ts     Recadrage carré + JPEG
    ├── signup/validation.ts Règles identiques à l’app
    ├── logo.ts / badges.ts Tracés du logo (K? issu de « logo eps/EPS/Group.eps ») et pictogrammes de badges
    ├── config.ts           Lecture des variables VITE_*
    ├── legal.css           Styles des pages légales et 404
    └── style.css           Styles (tokens de DESIGN_TOKENS.md)
```

Trajet du logo 3D : chaque section porte `data-heart="x,y,taille,rotation"` (desktop) et
`data-heart-m` (mobile ≤ 820 px). `x`/`y` en fraction de l'écran (−0.5 … 0.5), `taille` en
fraction de la hauteur ; `taille = 0` masque le logo.

## Médias générés (Higgsfield)

| Fichier | Modèle | Détail |
| --- | --- | --- |
| `public/media/hero.mp4` (+ `hero-mobile.mp4`) | Kling 3.0 Pro, 10 s, 16:9 | silhouettes face à face dans un brouillard magenta ; boucle aller-retour, H.264 sans son |
| `public/media/reveal.mp4` | Kling 3.0 Pro, 10 s, 1:1 | portrait ; GOP court pour être piloté par le scroll |

Prompts exacts dans `media-src/*.json`. Personnes fictives générées par IA (mentionné dans
les mentions légales).

## Accessibilité

- `prefers-reduced-motion` : pas de défilement fluide, animations coupées, vidéo de révélation en lecture simple.
- Sans WebGL : le logo 3D est remplacé par `assets/k-logo.svg`.
- Sans JavaScript : l'écran de chargement s'efface seul après 8 s, le contenu reste lisible.
- Contrastes AA vérifiés (Lighthouse 100).
