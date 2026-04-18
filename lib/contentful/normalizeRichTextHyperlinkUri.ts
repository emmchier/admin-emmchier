/**
 * TipTap often keeps whatever the user typed in the link dialog. Values like `example.com/path`
 * become relative paths on the current origin when rendered (`/example.com/path` behavior varies).
 * External URLs should be absolute so they work on any consuming site.
 */
export function normalizeRichTextHyperlinkUri(raw: string): string {
  const t = raw.trim();
  if (!t) return '';

  const lower = t.toLowerCase();
  if (
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:') ||
    lower.startsWith('#') ||
    lower.startsWith('//') ||
    lower.startsWith('http://') ||
    lower.startsWith('https://')
  ) {
    return t;
  }

  // Site-relative or path-relative (keep as authored)
  if (t.startsWith('/') || t.startsWith('./') || t.startsWith('../')) {
    return t;
  }

  // Looks like `domain.tld` or `domain.tld/foo` (no scheme)
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}/i.test(t)) {
    return `https://${t}`;
  }

  return t;
}
