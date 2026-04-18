'use client';

import type { ContentTypeProps } from 'contentful-management';
import { htmlStringToContentfulDocument } from '@/lib/contentful/htmlToContentfulRichText';

function looksLikeTipTapHtmlFragment(s: string): boolean {
  const t = s.trim();
  if (!t.startsWith('<')) return false;
  return (
    /<\/[a-z][a-z0-9]*>/i.test(t) ||
    /^<hr\b/i.test(t) ||
    /^<br\b/i.test(t)
  );
}

/**
 * Hub / Art dashboard forms may hold Rich Text fields as TipTap HTML strings after editing.
 * Contentful CMA expects Rich Text JSON objects — convert those strings before update/create.
 */
export function normalizeRichTextFieldsForSave(
  contentType: ContentTypeProps | null | undefined,
  fields: Record<string, unknown>,
): Record<string, unknown> {
  if (!contentType?.fields?.length) return fields;
  const out: Record<string, unknown> = { ...fields };
  for (const f of contentType.fields) {
    if (!f?.id || f.type !== 'RichText') continue;
    const v = out[f.id];
    if (typeof v !== 'string' || !looksLikeTipTapHtmlFragment(v)) continue;
    out[f.id] = htmlStringToContentfulDocument(v) as unknown;
  }
  return out;
}
