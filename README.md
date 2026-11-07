# Kiess — site vitrine & préinscription

Site statique (Vite + TypeScript + Three.js + GSAP + Lenis) en français : page d'accueil,
mentions légales, politique de confidentialité, page 404.

Les préinscriptions sont enregistrées, par défaut, **dans la base MySQL de l'hébergement
Hostinger** par le script livré avec le site (`public/api/preinscription.php`). Quand l'API
Kiess sera en ligne, une seule variable (`VITE_API_URL`) bascule le formulaire vers
`POST /pre-registrations` (module [`api/src/pre-registrations`](../api/src/pre-registrations),
table Postgres `PreRegistration`). Les deux appliquent exactement les mêmes règles.

## Lancer

```bash
cd web
npm install
npm run dev        # http://localhost:5173 (formulaire en mode démo : rien n'est envoyé)
npm run build      # typecheck + build → dist/
npm run preview    # sert dist/ avec les mêmes en-têtes de sécurité qu'en production
```

Node 20+ (testé avec Node 24).

## Variables d'environnement

Copier `.env.example` en `.env`. Les variables `VITE_*` sont injectées **au build**.

| Clé | Rôle |
| --- | --- |
| `VITE_SITE_URL` | Adresse publique du site (défaut `https://kiess.fr`) : balises canonical, Open Graph, sitemap. |
| `VITE_API_URL` | Facultatif. Si renseignée, le formulaire poste sur `{VITE_API_URL}/pre-registrations` au lieu du script PHP. **Ajouter alors ce domaine à `connect-src`** dans `public/.htaccess` (CSP). |
| `VITE_BETA_ENDPOINT` | Facultatif : URL complète du formulaire, prioritaire sur tout le reste. |

## Mise en ligne sur Hostinger (hébergement web)

1. **Base de données** — hPanel → Bases de données → Gestion : créer une base MySQL et
   son utilisateur (noter nom de base, utilisateur, mot de passe).
2. **Identifiants** — gestionnaire de fichiers : dans le dossier du domaine, **à côté** de
   `public_html` (pas dedans), créer `kiess-config.php` à partir de
   [`server/kiess-config.exemple.php`](server/kiess-config.exemple.php). Ainsi les
   identifiants ne sont jamais accessibles depuis le web.
   ```
   domains/kiess.fr/
   ├── kiess-config.php   ← ici
   └── public_html/       ← contenu de dist/
   ```
3. **Site** — `npm run build`, puis envoyer le **contenu** de `dist/` dans `public_html`
   (fichiers cachés `.htaccess` compris).
4. **PHP** — hPanel → Avancé → Configuration PHP : version 8.1 ou plus.
5. **SSL** — hPanel → Sécurité → SSL : certificat actif. Le `.htaccess` force déjà le HTTPS.
6. **Test** — faire une préinscription : les tables `preinscriptions` et
   `preinscription_limites` se créent toutes seules à la première demande.
7. **Référencement** — déclarer `https://kiess.fr/sitemap.xml` dans Google Search Console.

### Sélectionner les profils (phpMyAdmin)

hPanel → Bases de données → phpMyAdmin → onglet SQL :

```sql
-- Femmes de 20 à 30 ans en attente, premières inscrites d'abord
SELECT id, email, gender, preferences, birth_date,
       TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) AS age, source, created_at
FROM preinscriptions
WHERE status = 'pending' AND gender = 'une femme'
  AND TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) BETWEEN 20 AND 30
ORDER BY created_at;

-- Retenir des profils (pending → selected → invited ; ou rejected)
UPDATE preinscriptions SET status = 'selected' WHERE id IN (12, 15, 31);

-- Répartition par statut et par genre
SELECT status, gender, COUNT(*) FROM preinscriptions GROUP BY status, gender;

-- Droit à l'effacement (demande reçue sur support@kiess.fr)
DELETE FROM preinscriptions WHERE email = 'adresse@exemple.fr';
```

`preferences` : `homme,femme,nb` séparés par des virgules ; vide = « tout le monde ».
Export CSV : phpMyAdmin → Exporter. Le mot de passe est stocké en **argon2id** avec les
réglages de l'app (`api/src/auth/password.util.ts`) : ces comptes pourront être importés
tels quels dans la table `PreRegistration` / `User` de l'API (vérifié avec `argon2.verify`).

À faire au moment des invitations : le mail « ton accès est prêt » promis sur l'écran de
succès, et la purge des préinscriptions de plus de 24 mois (durée annoncée dans la
politique de confidentialité).

## Contrat du formulaire

Côté site : [`src/beta/submit.ts`](src/beta/submit.ts) (seul fichier qui parle au réseau).
Côté serveur : [`public/api/preinscription.php`](public/api/preinscription.php) et
[`CreatePreRegistrationDto`](../api/src/pre-registrations/dto/create-pre-registration.dto.ts) :
toute clé inconnue est refusée, garder les trois alignés.

```jsonc
{
  "email": "camille@exemple.fr",          // trim + minuscules
  "password": "Kiess2026",                // 8 à 128 caractères, 1 majuscule, 1 chiffre
  "gender": "une femme",                  // "un homme" | "une femme" | "non binaire" | "autres"
  "preferences": ["homme"],               // sous-ensemble de "homme" | "femme" | "nb" ; [] = tout le monde
  "birthDate": "1999-03-12",              // AAAA-MM-JJ, 18 ans minimum
  "acceptedTerms": true,                  // consentement (politique de confidentialité, art. 9 RGPD)
  "marketingOptIn": false,
  "website": "",                          // pot de miel : si rempli, réponse 201 mais rien n'est enregistré
  "source": { "utm_source": "instagram" },// facultatif (paramètres utm_* / ref de l'URL)
  "submittedAt": "2026-11-07T10:00:00.000Z"
}
```

| Statut | Cas | Affichage |
| --- | --- | --- |
| `201` | Enregistré, pot de miel rempli, ou e-mail déjà inscrit (PHP : ne révèle jamais qui est inscrit) | « Demande envoyée » |
| `409` | E-mail déjà inscrit (API Nest uniquement) | « Cette adresse mail est déjà préinscrite. » |
| `400` | Donnée refusée (moins de 18 ans, date impossible, mot de passe faible…) | `message` du corps |
| `429` | Plus de 5 envois par minute (ou 30 par jour) depuis la même IP | « Trop de tentatives… » |
| autre | Base indisponible, réseau | Message générique |

Protections du script PHP : même origine uniquement (en-têtes `Origin` / `Sec-Fetch-Site`),
JSON obligatoire, 8 Ko maximum, requêtes SQL préparées, limite par IP stockée sous forme
d'empreinte HMAC 24 h (jamais l'adresse en clair), identifiants hors du dossier public,
`api/.htaccess` qui n'expose que `preinscription.php`.

## SEO, sécurité, données

- **SEO** : title / description, canonical, Open Graph + Twitter (`og-kiess.jpg` 1200×630),
  favicons (ico, svg, apple-touch), données structurées Organization / WebSite / FAQPage
  générées depuis la FAQ visible, `robots.txt` et `sitemap.xml` générés au build
  (plugin `kiess-seo` de `vite.config.ts`), page 404 en `noindex`.
- **En-têtes** (`public/.htaccess`, repris par `npm run preview`) : CSP stricte (aucun script
  ni style en ligne, uniquement les fichiers du site), HSTS, X-Frame-Options, nosniff,
  Referrer-Policy, Permissions-Policy, COOP ; HTTPS forcé, `www` redirigé, fichiers
  techniques bloqués. Pas de `style="…"` ni de `<script>` en ligne dans le code : passer
  par `element.style.setProperty()`.
- **Données** : aucun cookie, traceur ni service tiers (polices et médias auto-hébergés).
  Consentement explicite et versionné (`consent_version`), pages `/confidentialite/` et
  `/mentions-legales/`. **Les champs surlignés en jaune** dans ces deux pages (éditeur,
  SIRET, directeur de la publication) **sont à compléter avant la mise en ligne**.
- **Lighthouse** (build de production, GPU) : mobile 88 / 100 / 100 / 100, desktop
  97 / 100 / 100 / 100 (performance / accessibilité / bonnes pratiques / SEO).

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
├── index.html              Accueil : contenu de toutes les sections + formulaire (dialog)
├── mentions-legales/       Mentions légales
├── confidentialite/        Politique de confidentialité
├── 404.html                Page introuvable
├── server/                 Modèle de kiess-config.php (non publié)
├── public/
│   ├── .htaccess           HTTPS, en-têtes de sécurité, cache (Hostinger)
│   ├── api/                preinscription.php + .htaccess
│   ├── media/              Médias optimisés (générés avec Higgsfield)
│   └── assets/             Logos, cœurs et pièces repris de mobile/assets/figma
├── media-src/              Fiches des générations Higgsfield (prompts, ids) ; rushes bruts ignorés par git
└── src/
    ├── main.ts             Orchestration : Lenis, chargement, trajet du logo 3D au scroll, intro
    ├── three/scene.ts      Scène WebGL (chargée à part) : logo K? 3D extrudé depuis l'EPS, petits cœurs, halo
    ├── sections.ts         Film, radar, slots, ticket, chat, grille de révélation, jeux, curseur…
    ├── beta/form.ts        Formulaire en 5 étapes (validation, navigation)
    ├── beta/submit.ts      Envoi + contrat serveur
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
