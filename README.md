# Kiess — site vitrine & préinscription

Site statique (Vite + TypeScript + Three.js + GSAP + Lenis), une seule page, en français.
Le formulaire de préinscription envoie les inscriptions à l'API Kiess
(`POST /pre-registrations`, module [`api/src/pre-registrations`](../api/src/pre-registrations)),
qui les enregistre dans la table `PreRegistration` de la base Postgres.

## Lancer

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build → dist/
npm run preview    # sert dist/ sur http://localhost:4173
```

Node 20+ (testé avec Node 24).

## Variables d'environnement

Copier `.env.example` en `.env` :

| Clé | Rôle |
| --- | --- |
| `VITE_API_URL` | Adresse de l'API (même valeur que `EXPO_PUBLIC_API_URL` du mobile). Le formulaire poste sur `{VITE_API_URL}/pre-registrations`, les liens légaux pointent vers `{VITE_API_URL}/legal/cgu` et `/legal/privacy`. **Vide = mode démo** : rien n'est envoyé, l'écran de succès affiche « Mode démo ». |
| `VITE_BETA_ENDPOINT` | Facultatif : URL complète du formulaire si elle diffère de la précédente. |
| `VITE_CGU_URL` / `VITE_PRIVACY_URL` | Facultatifs : liens légaux s'ils sont hébergés ailleurs. |

Les variables `VITE_*` sont injectées **au build** : rebuild après modification.

### Brancher le formulaire sur la base (une fois l'API déployée)

1. **API** (Render → Environment) :
   - `CORS_ORIGINS` : ajouter le domaine du site, ex. `https://kiess.fr,https://www.kiess.fr`
     (sans quoi le navigateur bloque l'envoi) ;
   - `TRUST_PROXY=1` (déjà dans `render.yaml`) : sans lui, la limite de 5 envois/minute
     s'applique à tous les visiteurs à la fois ;
   - `ADMIN_TOKEN` : jeton long et aléatoire pour consulter les préinscriptions.
   La migration `20261107100000_pre_registration` crée la table au démarrage
   (`prisma migrate deploy`).
2. **Site** : `VITE_API_URL=https://<adresse-de-l-api>` dans `web/.env`, puis `npm run build`
   et envoi de `dist/` sur l'hébergement.
3. Tester une préinscription depuis le site : la ligne apparaît dans `PreRegistration`
   (Prisma Studio : `cd api && npx prisma studio`).

## Contrat de l'endpoint de préinscription

Côté site : [`src/beta/submit.ts`](src/beta/submit.ts) (seul fichier qui parle au réseau).
Côté API : [`CreatePreRegistrationDto`](../api/src/pre-registrations/dto/create-pre-registration.dto.ts) :
toute clé absente du DTO est refusée, garder les deux alignés.

```http
POST {VITE_API_URL}/pre-registrations
Content-Type: application/json
```

```jsonc
{
  "email": "camille@exemple.fr",          // trim + minuscules
  "password": "Kiess2026",                // ≥ 8 caractères, 1 majuscule, 1 chiffre (mêmes règles que CompleteSignupDto)
  "gender": "une femme",                  // "un homme" | "une femme" | "non binaire" | "autres" (libellés de l'onboarding mobile)
  "preferences": ["homme"],               // sous-ensemble de "homme" | "femme" | "nb" ; [] = tout le monde (cf. matching/compatibility.ts)
  "birthDate": "1999-03-12",              // AAAA-MM-JJ, 18 ans minimum
  "acceptedTerms": true,
  "marketingOptIn": false,
  "website": "",                          // pot de miel : si rempli, réponse 201 mais rien n'est enregistré
  "source": { "utm_source": "instagram" },// facultatif (paramètres utm_* / ref de l'URL)
  "submittedAt": "2026-11-06T10:00:00.000Z"
}
```

Réponses de l'API et affichage sur le site :

| Statut | Cas | Affichage |
| --- | --- | --- |
| `201` | Enregistré (ou pot de miel rempli) | Écran « Demande envoyée » |
| `409` | E-mail déjà préinscrit | « Cette adresse mail est déjà préinscrite. » |
| `400` | Donnée refusée (moins de 18 ans, date impossible, mot de passe faible…) | `message` du corps, mêmes textes que la validation du site |
| `429` | Plus de 5 envois par minute depuis la même IP | « Trop de tentatives… » |
| autre / réseau | | Message générique |

Côté serveur : revalidation de tous les champs, mot de passe hashé en argon2id (comme les
comptes de l'app), e-mail en minuscules et unique, source réduite aux clés `utm_*` / `ref`.

### Sélectionner les profils

Chaque préinscription a un statut `pending` → `selected` / `rejected` → `invited`.
Routes protégées par l'en-tête `X-Admin-Token` (variable `ADMIN_TOKEN` de l'API) :

```bash
# Femmes de 20 à 30 ans encore en attente, les premières inscrites d'abord
curl -H "X-Admin-Token: $ADMIN_TOKEN" \
  "$API/admin/pre-registrations?status=pending&gender=une%20femme&minAge=20&maxAge=30&limit=100"

# Retenir un profil
curl -X PATCH -H "X-Admin-Token: $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"selected"}' "$API/admin/pre-registrations/<id>"
```

La liste renvoie `{ total, limit, offset, counts, items }` (âge calculé, jamais le hash du mot de passe).
Filtres : `status`, `gender` (`un homme` | `une femme` | `non binaire` | `autres`), `minAge`, `maxAge`,
`limit` (≤ 500), `offset`.

Le message de succès promet un mail « dès que ton accès est prêt » : cet envoi reste à faire
au moment des invitations (statut `invited`).

⚠️ L'API est sur l'offre gratuite de Render : après inactivité, la première requête peut
prendre ~50 s. Le bouton reste en « Envoi… » pendant ce temps ; passer sur une offre payante
(ou un endpoint séparé) avant d'ouvrir les inscriptions.

## Déploiement

`npm run build` produit un dossier `dist/` 100 % statique (Hostinger, Netlify, Cloudflare Pages…).
Aucun serveur Node requis. Sur Hostinger : contenu de `dist/` dans `public_html`
(le fichier `public/.htaccess` gère cache, compression et types MIME).

## Structure

```
web/
├── index.html              Contenu et textes de toutes les sections + formulaire (dialog)
├── public/
│   ├── media/              Médias optimisés (générés avec Higgsfield, voir plus bas)
│   └── assets/             Logos, cœurs et pièces repris de mobile/assets/figma
├── media-src/              Fiches des générations Higgsfield (prompts, ids) ; rushes bruts ignorés par git
└── src/
    ├── main.ts             Orchestration : Lenis, chargement, trajet du logo 3D au scroll, intro
    ├── three/scene.ts      Scène WebGL : logo K? 3D (extrudé depuis l'EPS), petits cœurs, halo
    ├── sections.ts         Film, radar, slots, ticket, chat, grille de révélation, jeux, curseur…
    ├── beta/form.ts        Formulaire en 5 étapes (validation, navigation)
    ├── beta/submit.ts      Envoi + contrat backend
    ├── logo.ts / badges.ts Tracés du logo (K? issu de « logo eps/EPS/Group.eps ») et pictogrammes de badges
    ├── config.ts           Lecture des variables VITE_*
    └── style.css           Styles (tokens de DESIGN_TOKENS.md)
```

Trajet du logo 3D : chaque section porte `data-heart="x,y,taille,rotation"` (desktop) et
`data-heart-m` (mobile ≤ 820 px). `x`/`y` en fraction de l'écran (−0.5 … 0.5), `taille` en
fraction de la hauteur ; `taille = 0` masque le cœur.

## Médias générés (Higgsfield)

| Fichier | Modèle | Détail |
| --- | --- | --- |
| `public/media/hero.mp4` (+ `hero-mobile.mp4`) | Kling 3.0 Pro, 10 s, 16:9 | silhouettes face à face dans un brouillard magenta ; boucle aller-retour, H.264 sans son |
| `public/media/reveal.mp4` | Kling 3.0 Pro, 10 s, 1:1 | portrait « Julia » ; GOP court pour être piloté par le scroll |

Prompts exacts dans `media-src/*.json`. Personnes fictives générées par IA.

Le logo 3D n'est pas un fichier : il est extrudé en temps réel (Three.js) depuis les tracés vectoriels
du K? officiel (`src/logo.ts`, extraits de l'EPS Illustrator). Le cœur 3D Tripo (`media-src/heart.glb`)
n'est plus utilisé.

## Accessibilité & perfs

- `prefers-reduced-motion` : pas de défilement fluide, animations coupées, vidéo de révélation en lecture simple.
- Sans WebGL : le logo 3D est remplacé par `assets/k-logo.svg`.
- Mobile : moins de particules, DPR plafonné, vidéo hero 720p (272 Ko).
- Polices Roboto auto-hébergées (`@fontsource`) : aucun appel à Google Fonts (RGPD).
