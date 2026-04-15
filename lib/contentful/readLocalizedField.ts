/**
 * Read a localized **scalar** field (Symbol, Text, Integer, etc.).
 *
 * - CMA: `{ [locale]: value }`
 * - CDA / resolved: plain `string` | `number` | `boolean`
 *
 * Do not use `Object.values()` on unknown values: strings become single-character "values".
 * Entry/Asset links (`{ sys: ... }`) are not localized scalars → empty string.
 */
export function readLocalizedField(raw: unknown, locale: string): string {
  if (raw == null) return '';
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
    return String(raw);
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return '';
  }
  const o = raw as Record<string, unknown>;
  if (o.sys != null && typeof o.sys === 'object') {
    return '';
  }
  const direct = o[locale] ?? o['en-US'];
  if (typeof direct === 'string' || typeof direct === 'number' || typeof direct === 'boolean') {
    return String(direct);
  }
  const first = Object.values(o).find(
    (x) => typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean',
  );
  return first != null ? String(first) : '';
}
