import { describe, it, expect } from 'vitest';
import { dict } from '../i18n/dict.js';

// Every key must exist in both languages with the same placeholders,
// so no screen can fall back to a raw key in one language.
const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]
  );
const placeholders = (s) => (String(s).match(/\{\w+\}/g) || []).sort();

describe('translation dictionary', () => {
  const ar = Object.fromEntries(flatten(dict.ar));
  const en = Object.fromEntries(flatten(dict.en));

  it('has the same keys in Arabic and English', () => {
    const onlyAr = Object.keys(ar).filter((k) => !(k in en));
    const onlyEn = Object.keys(en).filter((k) => !(k in ar));
    expect(onlyAr, 'keys missing in English').toEqual([]);
    expect(onlyEn, 'keys missing in Arabic').toEqual([]);
  });

  it('has no empty strings', () => {
    const empty = [...Object.entries(ar), ...Object.entries(en)].filter(([, v]) => String(v).trim() === '');
    expect(empty).toEqual([]);
  });

  it('uses the same placeholders in both languages', () => {
    const diff = Object.keys(ar).filter((k) => k in en && placeholders(ar[k]).join() !== placeholders(en[k]).join());
    expect(diff).toEqual([]);
  });

  it('keeps English text out of the Arabic column except for product names and code', () => {
    const suspicious = Object.entries(ar).filter(([, v]) => /^[A-Za-z][A-Za-z ,.'!?-]{15,}$/.test(String(v)));
    expect(suspicious).toEqual([]);
  });
});
