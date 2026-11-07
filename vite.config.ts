import { defineConfig, loadEnv, type Plugin } from 'vite';

/** Pages publiées (et listées dans le sitemap, sauf 404). */
const PAGES = {
  main: 'index.html',
  mentions: 'mentions-legales/index.html',
  confidentialite: 'confidentialite/index.html',
  notFound: '404.html',
};
const SITEMAP = ['/', '/mentions-legales/', '/confidentialite/'];

/**
 * En-têtes de sécurité : identiques à public/.htaccess (production Hostinger),
 * appliqués aussi à `npm run preview` pour vérifier que la CSP ne casse rien.
 */
export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; " +
    "font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; " +
    "form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

/** Données structurées générées depuis le contenu visible (la FAQ reste la seule source). */
function jsonLd(html: string, site: string): string {
  const faq = [...html.matchAll(/<details>\s*<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>\s*<\/details>/g)].map(
    ([, q, a]) => ({ '@type': 'Question', name: decode(q), acceptedAnswer: { '@type': 'Answer', text: decode(a) } }),
  );
  const graph = [
    {
      '@type': 'Organization',
      '@id': `${site}/#organization`,
      name: 'Kiess',
      url: `${site}/`,
      logo: `${site}/assets/kiess-logo-512.png`,
      email: 'support@kiess.fr',
      slogan: 'Découvrez qui vous rencontrez',
    },
    {
      '@type': 'WebSite',
      '@id': `${site}/#website`,
      name: 'Kiess',
      url: `${site}/`,
      inLanguage: 'fr-FR',
      publisher: { '@id': `${site}/#organization` },
    },
    ...(faq.length ? [{ '@type': 'FAQPage', '@id': `${site}/#faq`, mainEntity: faq }] : []),
  ];
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${json}</script>`;
}

function seo(site: string): Plugin {
  return {
    name: 'kiess-seo',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const out = html.replaceAll('__SITE_URL__', site);
        return out.includes('<!--seo:jsonld-->') ? out.replace('<!--seo:jsonld-->', jsonLd(out, site)) : out;
      },
    },
    generateBundle() {
      const today = new Date().toISOString().slice(0, 10);
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${site}/sitemap.xml\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          SITEMAP.map((p) => `  <url><loc>${site}${p}</loc><lastmod>${today}</lastmod></url>`).join('\n') +
          '\n</urlset>\n',
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  // Adresse publique du site (balise canonical, Open Graph, sitemap)
  const site = (env.VITE_SITE_URL || 'https://kiess.fr').replace(/\/+$/, '');
  return {
    plugins: [seo(site)],
    server: { port: 5173, host: true },
    preview: { headers: SECURITY_HEADERS },
    build: {
      target: 'es2020',
      assetsInlineLimit: 0,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        input: PAGES, // chemins relatifs à la racine du projet
      },
    },
  };
});
