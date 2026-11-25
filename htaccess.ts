/**
 * Configuration des hébergeurs, une seule source pour les en-têtes :
 *  - Hostinger (LiteSpeed / Apache) : `.htaccess` écrit à la racine de dist/
 *    au build (vite.config.ts), donc à la racine de public_html ;
 *  - Vercel (kiess.fr) : `vercel.json`, à la racine du dépôt (npm run
 *    vercel-json) et dans dist/ (déploiement du dossier déjà construit).
 * Les mêmes en-têtes de sécurité sont appliqués à `npm run preview`.
 *
 * `connect` : origines que la page peut appeler en plus d'elle-même, déduites
 * de VITE_API_URL (l'API Kiess) et de VITE_UPLOADS_ORIGIN (stockage des photos).
 */

/** Origines autorisées (CSP connect-src) déduites du .env : l'API et le stockage des photos. */
export function connectOrigins(env: Record<string, string | undefined>): string[] {
  return [env.VITE_API_URL, env.VITE_UPLOADS_ORIGIN].flatMap((url) => {
    if (!url?.trim()) return [];
    try {
      return [new URL(url.trim()).origin];
    } catch {
      throw new Error(`Adresse invalide dans .env : ${url}`);
    }
  });
}

export function contentSecurityPolicy(connect: string[]): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self'",
    `connect-src ${["'self'", ...connect].join(' ')}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function securityHeaders(connect: string[]): Record<string, string> {
  return {
    'Content-Security-Policy': contentSecurityPolicy(connect),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    // Origine seule, même vers le site : les réponses des connexions sociales
    // (code Discord dans l'adresse) ne se retrouvent pas dans les journaux.
    'Referrer-Policy': 'strict-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    // Les fichiers du site ne peuvent pas être chargés par une autre page web.
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Permitted-Cross-Domain-Policies': 'none',
  };
}

type VercelHeader = { key: string; value: string };

/**
 * vercel.json : en-têtes de sécurité (les mêmes que .htaccess, CSP avec
 * upgrade-insecure-requests, HSTS), cache des fichiers versionnés et des
 * médias, www.kiess.fr → kiess.fr. `build` : réglages de build pour un projet
 * relié au dépôt (vercel.json de la racine) ; sans, pour le déploiement de
 * dist/ déjà construit (vercel.json de dist/).
 */
export function vercelConfig(connect: string[], site: string, options: { build: boolean }) {
  const security: VercelHeader[] = Object.entries(securityHeaders(connect)).map(([key, value]) => ({
    key,
    value: key === 'Content-Security-Policy' ? `${value}; upgrade-insecure-requests` : value,
  }));
  security.push({ key: 'Strict-Transport-Security', value: 'max-age=31536000' });
  const host = new URL(site).host;
  return {
    $schema: 'https://openapi.vercel.sh/vercel.json',
    ...(options.build ? { framework: 'vite', buildCommand: 'npm run build', outputDirectory: 'dist' } : {}),
    headers: [
      { source: '/(.*)', headers: security },
      // Fichiers versionnés par Vite (nom avec empreinte) : cache long
      { source: '/assets/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      // Vidéos et images du site : 1 semaine
      { source: '/media/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }] },
    ],
    // Une seule adresse pour les moteurs de recherche : www → domaine nu
    redirects: [
      { source: '/(.*)', has: [{ type: 'host', value: `www.${host}` }], destination: `https://${host}/$1`, permanent: true },
    ],
  };
}

/** Texte de vercel.json (JSON indenté, fin de ligne finale). */
export function vercelJson(connect: string[], site: string, options: { build: boolean }): string {
  return `${JSON.stringify(vercelConfig(connect, site, options), null, 2)}
`;
}

export function htaccess(connect: string[]): string {
  const headers = Object.entries(securityHeaders(connect))
    .map(([name, value]) => {
      const v = name === 'Content-Security-Policy' ? `${value}; upgrade-insecure-requests` : value;
      return `  Header always set ${name} "${v}"`;
    })
    .join('\n');

  return `# Kiess — configuration Hostinger (LiteSpeed / Apache).
# Fichier généré par npm run build (web/htaccess.ts) : modifier la source, pas ce fichier.

Options -Indexes
DirectoryIndex index.html
ErrorDocument 404 /404.html

<IfModule mod_rewrite.c>
  RewriteEngine On

  # HTTPS obligatoire (redirection permanente)
  RewriteCond %{HTTPS} !=on
  RewriteCond %{HTTP:X-Forwarded-Proto} !=https
  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

  # Une seule adresse pour les moteurs de recherche : www.kiess.fr → kiess.fr
  # (supprimer ces 2 lignes si le site doit être servi sur www)
  RewriteCond %{HTTP_HOST} ^www\\.(.+)$ [NC]
  RewriteRule ^ https://%1%{REQUEST_URI} [L,R=301]

  # Fichiers cachés et fichiers techniques jamais servis
  RewriteRule (^|/)\\.(?!well-known/) - [F]
  RewriteRule \\.(sql|md|log|ini|bak|old|sh|env|lock|ts|map|php)$ - [F,NC]
</IfModule>

<IfModule mod_mime.c>
  AddType video/mp4 .mp4
  AddType image/webp .webp
  AddType font/woff2 .woff2
  AddType image/svg+xml .svg
  AddType application/xml .xml
</IfModule>

<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css text/plain application/javascript image/svg+xml application/json application/xml
</IfModule>

<IfModule mod_headers.c>
  # ── Sécurité ──
  # CSP : uniquement les fichiers de ce site, plus l'API Kiess et le stockage des photos.
${headers}
  Header always set Strict-Transport-Security "max-age=31536000"
  Header always unset X-Powered-By
  Header unset X-Powered-By

  # ── Cache ──
  # Fichiers versionnés par Vite (nom avec empreinte) : cache long
  <FilesMatch "\\.(js|css|woff2?)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
  # Médias et images : 1 semaine
  <FilesMatch "\\.(mp4|jpg|jpeg|webp|png|svg|ico)$">
    Header set Cache-Control "public, max-age=604800"
  </FilesMatch>
  # Pages, robots.txt, sitemap : toujours revalidés, pour voir les mises à jour tout de suite
  <FilesMatch "\\.(html|txt|xml)$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>
`;
}
