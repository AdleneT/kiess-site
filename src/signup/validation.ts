/**
 * Règles de l'inscription, identiques à l'app (mobile/screens/onboarding/validation.ts)
 * et revérifiées par l'API (CompleteSignupDto, AuthService.completeSignup).
 */

export const DEFAULT_DIAL_CODE = '+33';
const E164_REGEX = /^\+[1-9]\d{6,14}$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
const USERNAME_REGEX = /^[a-z0-9._-]{2,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const ADULT_AGE = 18;

/** « 06 12 34 56 78 » → « +33612345678 » ; « +… » et « 00… » respectés. */
export function composeE164(raw: string, dialCode = DEFAULT_DIAL_CODE): string {
  const trimmed = raw.trim();
  const clean = (v: string) => v.replace(/[\s\-().]/g, '');
  if (trimmed.startsWith('+')) return clean(trimmed);
  if (trimmed.startsWith('00')) return clean(`+${trimmed.slice(2)}`);
  const digits = trimmed.replace(/\D/g, '').replace(/^0+/, '');
  return digits ? `${dialCode}${digits}` : '';
}

export const isValidE164 = (v: string) => E164_REGEX.test(v);
export const isValidOtp = (v: string) => /^\d{6}$/.test(v.trim());
export const normalizeEmail = (v: string) => v.trim().toLowerCase();
export const isValidEmail = (v: string) => EMAIL_REGEX.test(v.trim());
export const isValidName = (v: string) => v.trim().length >= 2;
export const normalizeUsername = (v: string) => v.trim().toLowerCase();
export const isValidUsername = (v: string) => USERNAME_REGEX.test(normalizeUsername(v));
export const isValidCity = (v: string) => v.trim().length >= 2;
export const isValidPassword = (v: string) => PASSWORD_REGEX.test(v);

/** Masque JJ/MM/AAAA. */
export function formatBirthDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** « 14/05/1998 » → « 1998-05-14 » ; null si la date n'existe pas. */
export function parseBirthDate(value: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** « 1998-05-14 » → « 14/05/1998 ». */
export function formatBirthDateFromIso(iso?: string | null): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

export function ageFromIso(iso: string, now = new Date()): number {
  const [y, m, d] = iso.split('-').map(Number);
  let age = now.getFullYear() - y;
  const monthDiff = now.getMonth() + 1 - m;
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d)) age -= 1;
  return age;
}
