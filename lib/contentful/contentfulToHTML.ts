import type { Document, Inline } from '@contentful/rich-text-types';
import { BLOCKS, INLINES } from '@contentful/rich-text-types';
import { documentToHtmlString } from '@contentful/rich-text-html-renderer';
import { normalizeRichTextHyperlinkUri } from '@/lib/contentful/normalizeRichTextHyperlinkUri';

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Default HTML renderer only reads `fields.file.url`. CMA usually stores files localized:
 * `fields.file['en-US'].url` — same resolution as `app/api/contentful/assets/route.ts`.
 */
function resolveAssetFileUrlFromTarget(target: unknown): string {
  if (!target || typeof target !== 'object') return '';
  const fields = (target as { fields?: { file?: Record<string, unknown> } }).fields;
  if (!fields?.file || typeof fields.file !== 'object') return '';
  const file = fields.file as Record<string, unknown>;
  if (typeof file.url === 'string') return file.url;
  for (const key of ['en-US', 'es']) {
    const loc = file[key];
    if (loc && typeof loc === 'object' && typeof (loc as { url?: string }).url === 'string') {
      return (loc as { url: string }).url;
    }
  }
  for (const v of Object.values(file)) {
    if (v && typeof v === 'object' && typeof (v as { url?: string }).url === 'string') {
      return (v as { url: string }).url;
    }
  }
  return '';
}

function resolveAssetDescriptionFromTarget(target: unknown): string {
  if (!target || typeof target !== 'object') return '';
  const raw = (target as { fields?: { description?: Record<string, unknown> | string } }).fields
    ?.description;
  if (typeof raw === 'string') return raw;
  if (!raw || typeof raw !== 'object') return '';
  for (const key of ['en-US', 'es']) {
    const loc = (raw as Record<string, unknown>)[key];
    if (typeof loc === 'string') return loc;
  }
  const first = Object.values(raw).find((x) => typeof x === 'string');
  return typeof first === 'string' ? first : '';
}

/**
 * Serialize Contentful Rich Text JSON to HTML for TipTap (`setContent` / initial `content`).
 */
export function contentfulToHTML(richText: Document): string {
  const html = documentToHtmlString(richText, {
    renderNode: {
      [INLINES.HYPERLINK]: (node, next) => {
        const data = node && typeof node === 'object' ? (node as { data?: { uri?: string }; content?: unknown }).data : undefined;
        const raw = typeof data?.uri === 'string' ? data.uri : '';
        const uri = raw ? normalizeRichTextHyperlinkUri(raw) : '';
        const inner = next((node as Inline).content ?? []);
        if (!uri) return inner;
        return `<a href="${escapeHtmlAttr(uri)}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
      },
      [BLOCKS.EMBEDDED_ASSET]: (node) => {
        const target = (node as { data?: { target?: unknown } }).data?.target;
        const path = resolveAssetFileUrlFromTarget(target);
        const imageUrl = path.startsWith('//') ? `https:${path}` : path;
        if (!imageUrl) return '';
        const alt = resolveAssetDescriptionFromTarget(target);
        return `<img src="${escapeHtmlAttr(imageUrl)}" alt="${escapeHtmlAttr(alt)}" loading="lazy" />`;
      },
    },
  });
  return html.trim().length > 0 ? html : '<p></p>';
}
