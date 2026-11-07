/**
 * CGU et politique de confidentialité du site = celles de l'app, générées au
 * build depuis legal-content.ts (copie de api/src/legal/legal-content.ts du
 * dépôt de l’app kiess-app/Kiess, aussi servie par
 * l'API et affichée dans l'app). Une inscription sur le site crée un compte de
 * l'app : les règles sont les mêmes.
 *
 * Les marqueurs <!--legal:cgu-->, <!--legal:privacy--> et <!--legal:updated-->
 * des pages cgu/ et confidentialite/ sont remplacés par le texte mis en forme.
 */
import { CGU_TEXT, LEGAL_LAST_UPDATE, PRIVACY_TEXT } from './legal-content';

const SUPPORT = '<a href="mailto:support@kiess.fr">support@kiess.fr</a>';

/** Valeurs des {{…}} : l'identité de l'éditeur reste à compléter (surlignée en jaune). */
const PLACEHOLDERS: Record<string, string> = {
  COMPANY: '<span class="todo">[Raison sociale ou nom de l’éditeur]</span>',
  ADDRESS: '<span class="todo">[Adresse du siège]</span>',
  CONTACT_EMAIL: SUPPORT,
  DPO_EMAIL: SUPPORT,
  COUNTRY: '<span class="todo">[Ville du tribunal compétent]</span>',
  HOST_PROVIDER: '<span class="todo">[Hébergeur de l’API]</span>',
};

const ACRONYMS = ['RGPD', 'DPO', 'CNIL', 'OTP', 'UE'];

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(text: string): string {
  return escape(text)
    .replace(/https:\/\/[^\s)]+?(?=[.,;)]?(\s|$))/g, (url) => `<a href="${url}" rel="noopener">${url.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '')}</a>`)
    .replace(/\{\{(\w+)\}\}/g, (_, key: string) => PLACEHOLDERS[key] ?? '');
}

/** « 4. DESTINATAIRES / SOUS-TRAITANTS » → « 4. Destinataires / sous-traitants ». */
function heading(line: string): string {
  let out = line.toLowerCase().replace(/^(\d+\.\s*)(\p{L})/u, (_, n: string, c: string) => n + c.toUpperCase());
  for (const a of ACRONYMS) out = out.replace(new RegExp(`\\b${a.toLowerCase()}\\b`, 'g'), a);
  return out;
}

export function legalHtml(text: string): string {
  const lines = text.split('\n').slice(1); // 1re ligne : date, affichée à part
  const html: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) html.push(`<ul>${list.map((li) => `<li>${li}</li>`).join('')}</ul>`);
    list = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith('•')) {
      list.push(inline(line.slice(1).trim()));
      continue;
    }
    flush();
    if (/^\d+\.\s+[^a-z]+$/.test(line)) html.push(`<h2>${escape(heading(line))}</h2>`);
    else html.push(`<p>${inline(line)}</p>`);
  }
  flush();
  return html.join('\n      ');
}

export function legalUpdated(): string {
  const [y, m, d] = LEGAL_LAST_UPDATE.split('-').map(Number);
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return `Version du ${d} ${months[m - 1]} ${y}`;
}

export function injectLegal(html: string): string {
  return html
    .replace('<!--legal:cgu-->', () => legalHtml(CGU_TEXT))
    .replace('<!--legal:privacy-->', () => legalHtml(PRIVACY_TEXT))
    .replace('<!--legal:updated-->', () => legalUpdated());
}
