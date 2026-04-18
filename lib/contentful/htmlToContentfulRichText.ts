'use client';

import type { Document } from '@contentful/rich-text-types';
import { generateJSON } from '@tiptap/html';
import { tiptapToContentful } from '@/lib/contentful/contentfulTiptapBridge';
import { getRichTextEditorExtensions } from '@/lib/contentful/richTextTiptapExtensions';

/** TipTap HTML export → Contentful Rich Text AST (requires browser DOM — import only from client code). */
export function htmlStringToContentfulDocument(html: string): Document {
  const trimmed = html.trim();
  const safe = trimmed.length > 0 ? trimmed : '<p></p>';
  const pmJson = generateJSON(safe, getRichTextEditorExtensions());
  return tiptapToContentful(pmJson);
}
