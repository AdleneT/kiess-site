import { defineConfig, loadEnv, type Plugin } from 'vite';
import { htaccess, securityHeaders } from './htaccess';
import { injectLegal } from './legal';

/** Pages publiées (et listées dans le sitemap, sauf 404). */
const PAGES = {
  main: 'index.html',
  cgu: 'cgu/index.html',
  mentions: 'mentions-legales/index.html',
  confidentialite: 'confidentialite/index.html',
  notFound: '404.html',
};
const SITEMAP = ['/', '/cgu/', '/mentions-legales/', '/confidentialite/'];

/** Origine (https://hôte[:port]) d'une adresse, ou rien si elle est vide ou invalide. */
function origin(url: string | undefined): string[] {
  if (!url?.trim()) return [];
  try {
    return [new URL(url.trim()).origin];
  } catch {
    throw new Error(`Adresse invalide dans .env : ${url}`);
  }
}

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

function seo(site: string, connect: string[]): Plugin {
  return {
    name: 'kiess-seo',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const out = injectLegal(html.replaceAll('__SITE_URL__', site));
        return out.includes('<!--seo:jsonld-->') ? out.replace('<!--seo:jsonld-->', jsonLd(out, site)) : out;
      },
    },
    generateBundle() {
      const today = new Date().toISOString().slice(0, 10);
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`,
      });
      this.emitFile({ type: 'asset', fileName: '.htaccess', source: htaccess(connect) });
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
  // Ce que la page peut appeler en plus d'elle-même : l'API Kiess et le stockage des photos
  const connect = [...origin(env.VITE_API_URL), ...origin(env.VITE_UPLOADS_ORIGIN)];
  if (mode === 'production' && !env.VITE_API_URL) {
    console.warn('\n⚠  VITE_API_URL vide : l’inscription du site sera en mode démo (aucun compte créé).\n');
  }
  return {
    plugins: [seo(site, connect)],
    server: { port: 5173, host: true },
    preview: { headers: securityHeaders(connect) },
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
