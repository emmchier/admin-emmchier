import type { Document } from '@contentful/rich-text-types';
import { BLOCKS } from '@contentful/rich-text-types';

function looksLikeLocaleEnvelope(o: Record<string, unknown>): Record<string, unknown> | null {
  const nt = o.nodeType;
  if (typeof nt === 'string' && nt.toLowerCase() === 'document') return null;
  const vals = Object.values(o).filter((x) => x != null && typeof x === 'object' && !Array.isArray(x));
  if (vals.length !== 1) return null;
  const inner = vals[0] as Record<string, unknown>;
  const inn = inner.nodeType;
  if (typeof inn === 'string' && inn.toLowerCase() === 'document') return inner;
  return null;
}

/**
 * Some CMA / stored payloads omit the root `nodeType: "document"` but keep
 * `data` + `content` (block-level children). Treat as a document shell.
 * Do not match a real block (e.g. paragraph): those always have `nodeType` set.
 */
function inferDocumentShell(o: Record<string, unknown>): Record<string, unknown> | null {
  const rawNt = o.nodeType;
  if (typeof rawNt === 'string' && rawNt.length > 0) {
    if (rawNt.toLowerCase() === 'document') return null;
    return null;
  }
  if (!('data' in o) || !('content' in o) || !Array.isArray(o.content)) return null;
  if (!(typeof o.data === 'object' && o.data !== null)) return null;
  if (o.content.length === 0) {
    return { ...o, nodeType: BLOCKS.DOCUMENT };
  }
  const first = o.content[0];
  if (!first || typeof first !== 'object') return null;
  const fstNt = String((first as Record<string, unknown>).nodeType ?? '');
  if (!fstNt || fstNt === 'text') return null;
  return { ...o, nodeType: BLOCKS.DOCUMENT };
}

/**
 * Normalizes Rich Text values from Management API / form state (JSON string,
 * casing, optional `content`) so the editor always receives a real document.
 */
export function coerceRichTextDocument(value: unknown): Document | undefined {
  let v: unknown = value;
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t.startsWith('{') && !t.startsWith('[')) return undefined;
    try {
      v = JSON.parse(v) as unknown;
    } catch {
      return undefined;
    }
  }
  if (!v || typeof v !== 'object') return undefined;
  let o = v as Record<string, unknown>;

  let nt = o.nodeType;
  let ntStr = typeof nt === 'string' ? nt.toLowerCase() : '';
  if (ntStr !== 'document') {
    const inner = looksLikeLocaleEnvelope(o);
    if (inner) {
      o = inner;
      nt = o.nodeType;
      ntStr = typeof nt === 'string' ? nt.toLowerCase() : '';
    } else {
      const shell = inferDocumentShell(o);
      if (shell) {
        o = shell;
        ntStr = 'document';
      } else {
        return undefined;
      }
    }
  }
  if (ntStr !== 'document') return undefined;

  const content = Array.isArray(o.content) ? o.content : [];
  const data =
    o.data !== undefined && typeof o.data === 'object' && o.data !== null
      ? (o.data as Record<string, unknown>)
      : {};
  return {
    nodeType: BLOCKS.DOCUMENT,
    data,
    content,
  } as Document;
}
