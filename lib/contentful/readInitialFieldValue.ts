/**
 * Resolve a single field's value for the editor from Management/Delivery `fields` shape.
 * Mirrors `SchemaDrivenEntryForm` initialization.
 */
export function readInitialFieldValue(
  initialFields: Record<string, any> | undefined,
  fieldId: string,
  locale: string,
): unknown {
  let raw = initialFields?.[fieldId];
  if (raw == null) return undefined;

  /** Some proxies / logs store Rich Text JSON as a string — normalize before branching. */
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t.startsWith('{') || t.startsWith('[')) {
      try {
        raw = JSON.parse(t) as unknown;
      } catch {
        return raw;
      }
    } else {
      return raw;
    }
  }

  if (
    typeof raw === 'string' ||
    typeof raw === 'number' ||
    typeof raw === 'boolean'
  ) {
    return raw;
  }
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'object') return undefined;
  const o = raw as Record<string, any>;
  if (o.sys != null && typeof o.sys === 'object') return o;
  if (typeof o.nodeType === 'string' && o.nodeType.toLowerCase() === 'document') {
    return o;
  }
  const localized = o[locale] ?? o['en-US'];
  if (localized !== undefined && localized !== null) return localized;

  for (const val of Object.values(o)) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
    const vn = val as Record<string, unknown>;
    if (
      typeof vn.nodeType === 'string' &&
      vn.nodeType.toLowerCase() === 'document'
    ) {
      return val;
    }
  }

  const vals = Object.values(o);
  return vals.length ? vals[0] : undefined;
}

export function buildFlatFieldMapFromEntry(
  initialFields: Record<string, any> | undefined,
  editableFields: Array<{ id: string }>,
  locale: string,
): Record<string, unknown> {
  const initial: Record<string, unknown> = {};
  for (const f of editableFields) {
    if (!f?.id) continue;
    const v = readInitialFieldValue(initialFields, f.id, locale);
    if (v !== undefined) initial[f.id] = v;
  }
  return initial;
}
