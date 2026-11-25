// vercel.json de la racine (projet Vercel relié au dépôt), généré depuis
// htaccess.ts et .env.production : mêmes en-têtes de sécurité que .htaccess.
//   npm run vercel-json         écrit vercel.json
//   node scripts/vercel-json.mjs --check   (lancé par npm run build) prévient
//                                          si vercel.json n'est plus à jour
import { readFileSync, writeFileSync } from 'node:fs';
import { loadEnv } from 'vite';
import { connectOrigins, vercelJson } from '../htaccess.ts';

const env = loadEnv('production', '.', 'VITE_');
const site = (env.VITE_SITE_URL || 'https://kiess.fr').replace(/\/+$/, '');
const expected = vercelJson(connectOrigins(env), site, { build: true });

if (process.argv.includes('--check')) {
  let committed = '';
  try {
    committed = readFileSync('vercel.json', 'utf8').replace(/\r\n/g, '\n');
  } catch {
    // Pas de vercel.json : rien à comparer.
  }
  if (committed && committed !== expected) {
    console.warn('\n⚠  vercel.json ne correspond plus aux en-têtes de ce build : lancer npm run vercel-json.\n');
  }
} else {
  if (!env.VITE_API_URL) {
    console.error('VITE_API_URL vide : renseigner les adresses de production (.env.production) avant de générer vercel.json.');
    process.exit(1);
  }
  writeFileSync('vercel.json', expected);
  console.log(`vercel.json écrit (connect-src : ${connectOrigins(env).join(' ')})`);
}
