/**
 * Configuration du serveur Hostinger (LiteSpeed / Apache) : `.htaccess` écrit
 * à la racine de dist/ au build (vite.config.ts), donc à la racine de
 * public_html. Les mêmes en-têtes de sécurité sont appliqués à `npm run preview`.
 *
 * `connect` : origines que la page peut appeler en plus d'elle-même, déduites
 * de VITE_API_URL (l'API Kiess) et de VITE_UPLOADS_ORIGIN (stockage des photos).
 */

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
