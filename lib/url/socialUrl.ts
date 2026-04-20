import { parse } from 'tldts';

export function stripUrlForDisplay(raw: string): string {
  const t = (raw || '').trim();
  if (!t) return '';
  return t.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '').replace(/^www\./i, '');
}

export function normalizeUrlForStorage(raw: string): string {
  const t = (raw || '').trim();
  if (!t) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(t)) return t;
  if (t.startsWith('www.')) return `https://${t}`;
  return `https://www.${t}`;
}

function toTitleWords(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!cleaned) return '';
  return cleaned
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function derivePlatformFromUrlInput(rawUrl: string): string {
  const normalized = normalizeUrlForStorage(rawUrl);
  if (!normalized) return '';
  try {
    const u = new URL(normalized);
    const host = u.hostname.toLowerCase();
    const p = parse(host);
    const base = (p.domainWithoutSuffix || '').trim();
    if (base) return toTitleWords(base);
    const first = host.replace(/^www\./, '').split('.').filter(Boolean)[0] ?? '';
    return toTitleWords(first);
  } catch {
    return '';
  }
}

export function validateSocialUrl(raw: string): { ok: boolean; normalized: string } {
  const rawTrimmed = (raw || '').trim();
  const stripped = rawTrimmed
    .replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '')
    .replace(/^www\./i, '');
  // Must include an explicit dot (e.g. "instagram.com"), not just "google".
  if (!stripped.includes('.')) return { ok: false, normalized: normalizeUrlForStorage(rawTrimmed) };

  const normalized = normalizeUrlForStorage(rawTrimmed);
  if (!normalized) return { ok: false, normalized: '' };
  try {
    const u = new URL(normalized);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, normalized };
    const host = u.hostname.toLowerCase();
    if (!host || !host.includes('.')) return { ok: false, normalized };
    const p = parse(host);
    // Require a real ICANN suffix (prevents fake TLDs like ".fake")
    if (!p.domain || !p.publicSuffix || !p.isIcann) return { ok: false, normalized };
    return { ok: true, normalized };
  } catch {
    return { ok: false, normalized };
  }
}

