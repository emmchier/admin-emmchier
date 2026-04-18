import type { Document } from '@contentful/rich-text-types';
import { BLOCKS, INLINES, MARKS } from '@contentful/rich-text-types';
import { coerceRichTextDocument } from '@/lib/contentful/coerceRichTextDocument';
import {
  extractAssetIdFromCfTarget,
  extractEntryIdFromCfTarget,
  makeCfAssetLinkTarget,
  makeCfEntryLinkTarget,
} from '@/lib/contentful/tiptapContentfulNodes';
import { normalizeRichTextHyperlinkUri } from '@/lib/contentful/normalizeRichTextHyperlinkUri';

/** TipTap / ProseMirror JSON shape */
export type TiptapJSON = Record<string, unknown>;

const EMPTY_TEXT_CF = {
  nodeType: 'text' as const,
  value: '',
  marks: [] as { type: string }[],
  data: {},
};

const HEADING_CF: (typeof BLOCKS)[keyof typeof BLOCKS][] = [
  BLOCKS.HEADING_1,
  BLOCKS.HEADING_2,
  BLOCKS.HEADING_3,
  BLOCKS.HEADING_4,
  BLOCKS.HEADING_5,
  BLOCKS.HEADING_6,
];

function emptyParagraphCf() {
  return {
    nodeType: BLOCKS.PARAGRAPH,
    data: {},
    content: [{ ...EMPTY_TEXT_CF }],
  };
}

export function emptyContentfulDocument(): Document {
  return {
    nodeType: BLOCKS.DOCUMENT,
    data: {},
    content: [emptyParagraphCf()],
  } as Document;
}

function extractPlainText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as Record<string, unknown>;
  if (n.nodeType === 'text' && typeof n.value === 'string') return n.value;
  const content = n.content;
  if (!Array.isArray(content)) return '';
  return content.map(extractPlainText).join('');
}

function previewUrlFromExpandedAssetTarget(target: unknown): string | null {
  if (!target || typeof target !== 'object') return null;
  const t = target as Record<string, unknown>;
  const file = t.fields && typeof t.fields === 'object' ? (t.fields as Record<string, unknown>).file : null;
  if (!file || typeof file !== 'object') return null;
  const loc = (file as Record<string, unknown>)['en-US'] ?? Object.values(file)[0];
  const url = loc && typeof loc === 'object' ? (loc as { url?: string }).url : null;
  return typeof url === 'string' && url ? url : null;
}

function mapCfMarks(marks: unknown): { type: string; attrs?: Record<string, unknown> }[] {
  if (!Array.isArray(marks)) return [];
  const out: { type: string; attrs?: Record<string, unknown> }[] = [];
  for (const m of marks) {
    if (!m || typeof m !== 'object') continue;
    const t = (m as { type?: string }).type;
    if (t === MARKS.BOLD) out.push({ type: 'bold' });
    else if (t === MARKS.ITALIC) out.push({ type: 'italic' });
    else if (t === MARKS.UNDERLINE) out.push({ type: 'underline' });
    else if (t === MARKS.CODE) out.push({ type: 'code' });
    else if (t === MARKS.STRIKETHROUGH) out.push({ type: 'strike' });
  }
  return out;
}

function mapCfTextToPm(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null;
  const n = node as Record<string, unknown>;
  if (n.nodeType !== 'text') return null;
  const text = typeof n.value === 'string' ? n.value : '';
  const marks = mapCfMarks(n.marks);
  const base: Record<string, unknown> = { type: 'text', text };
  if (marks.length) base.marks = marks;
  return base;
}

function applyLinkToFragments(
  fragments: Record<string, unknown>[],
  href: string,
): Record<string, unknown>[] {
  return fragments.map((f) => {
    if (f.type !== 'text') return f;
    const prev = Array.isArray(f.marks) ? [...f.marks] : [];
    prev.push({ type: 'link', attrs: { href, target: '_blank', rel: 'noopener noreferrer' } });
    return { ...f, marks: prev };
  });
}

function mapCfInlineContent(content: unknown): Record<string, unknown>[] {
  if (!Array.isArray(content)) return [{ type: 'text', text: '' }];
  const out: Record<string, unknown>[] = [];
  for (const raw of content) {
    if (!raw || typeof raw !== 'object') continue;
    const cn = raw as Record<string, unknown>;
    const nt = cn.nodeType as string;

    if (nt === 'text') {
      const pm = mapCfTextToPm(raw);
      if (pm) out.push(pm);
      continue;
    }

    if (
      nt === INLINES.HYPERLINK ||
      nt === INLINES.ENTRY_HYPERLINK ||
      nt === INLINES.ASSET_HYPERLINK ||
      nt === INLINES.RESOURCE_HYPERLINK
    ) {
      let uri =
        typeof (cn.data as { uri?: string })?.uri === 'string'
          ? (cn.data as { uri: string }).uri
          : '';
      if (uri && nt === INLINES.HYPERLINK) {
        uri = normalizeRichTextHyperlinkUri(uri);
      }
      const inner = mapCfInlineContent(cn.content);
      if (uri) out.push(...applyLinkToFragments(inner, uri));
      else out.push(...inner);
      continue;
    }

    if (nt === INLINES.EMBEDDED_ENTRY || nt === INLINES.EMBEDDED_RESOURCE) {
      const id = extractEntryIdFromCfTarget(cn.data);
      if (id) {
        out.push({ type: 'contentfulEntryInline', attrs: { entryId: id } });
      }
      continue;
    }
  }
  if (out.length === 0) out.push({ type: 'text', text: '' });
  return out;
}

function mapCfListItem(li: unknown): Record<string, unknown> {
  if (!li || typeof li !== 'object') {
    return { type: 'listItem', content: [{ type: 'paragraph' }] };
  }
  const node = li as Record<string, unknown>;
  const inner = Array.isArray(node.content) ? node.content : [];
  const blocks: Record<string, unknown>[] = [];
  for (const child of inner) {
    if (!child || typeof child !== 'object') continue;
    const ct = (child as { nodeType?: string }).nodeType;
    if (ct === BLOCKS.PARAGRAPH) {
      blocks.push({
        type: 'paragraph',
        content: mapCfInlineContent((child as { content?: unknown }).content),
      });
    } else if (ct === BLOCKS.UL_LIST || ct === BLOCKS.OL_LIST) {
      blocks.push(mapCfBlockToPm(child));
    } else {
      blocks.push(mapCfBlockToPm(child));
    }
  }
  return {
    type: 'listItem',
    content: blocks.length ? blocks : [{ type: 'paragraph' }],
  };
}

function mapCfBlockToPm(node: unknown): Record<string, unknown> {
  if (!node || typeof node !== 'object') {
    return { type: 'paragraph', content: [{ type: 'text', text: '' }] };
  }
  const n = node as Record<string, unknown>;
  const nt = n.nodeType;

  switch (nt) {
    case BLOCKS.PARAGRAPH:
      return {
        type: 'paragraph',
        content: mapCfInlineContent(n.content),
      };
    case BLOCKS.HEADING_1:
    case BLOCKS.HEADING_2:
    case BLOCKS.HEADING_3:
    case BLOCKS.HEADING_4:
    case BLOCKS.HEADING_5:
    case BLOCKS.HEADING_6: {
      const level =
        nt === BLOCKS.HEADING_1
          ? 1
          : nt === BLOCKS.HEADING_2
            ? 2
            : nt === BLOCKS.HEADING_3
              ? 3
              : nt === BLOCKS.HEADING_4
                ? 4
                : nt === BLOCKS.HEADING_5
                  ? 5
                  : 6;
      return {
        type: 'heading',
        attrs: { level },
        content: mapCfInlineContent(n.content),
      };
    }
    case BLOCKS.UL_LIST:
      return {
        type: 'bulletList',
        content: (Array.isArray(n.content) ? n.content : []).map(mapCfListItem),
      };
    case BLOCKS.OL_LIST:
      return {
        type: 'orderedList',
        content: (Array.isArray(n.content) ? n.content : []).map(mapCfListItem),
      };
    case BLOCKS.LIST_ITEM:
      return mapCfListItem(node);
    case BLOCKS.HR:
      return { type: 'horizontalRule' };
    case BLOCKS.QUOTE:
      return {
        type: 'blockquote',
        content: (Array.isArray(n.content) ? n.content : []).map(mapCfBlockToPm),
      };
    case BLOCKS.EMBEDDED_ASSET: {
      const assetId = extractAssetIdFromCfTarget(n.data);
      const embedData = n.data as { target?: unknown } | undefined;
      const previewSrc = previewUrlFromExpandedAssetTarget(embedData?.target) ?? null;
      if (assetId) {
        return {
          type: 'contentfulAsset',
          attrs: { assetId, previewSrc },
        };
      }
      break;
    }
    case BLOCKS.EMBEDDED_ENTRY: {
      const entryId = extractEntryIdFromCfTarget(n.data);
      if (entryId) {
        return { type: 'contentfulEntryBlock', attrs: { entryId } };
      }
      break;
    }
    case BLOCKS.TABLE:
      return {
        type: 'table',
        content: (Array.isArray(n.content) ? n.content : []).map((row: unknown) => {
          const r = row as Record<string, unknown>;
          return {
            type: 'tableRow',
            content: (Array.isArray(r.content) ? r.content : []).map((cell: unknown) => {
              const c = cell as Record<string, unknown>;
              const isHeader = c.nodeType === BLOCKS.TABLE_HEADER_CELL;
              return {
                type: isHeader ? 'tableHeader' : 'tableCell',
                content: (Array.isArray(c.content) ? c.content : []).map(mapCfBlockToPm),
              };
            }),
          };
        }),
      };
    default: {
      const plain = extractPlainText(node);
      return {
        type: 'paragraph',
        content: plain
          ? [{ type: 'text', text: plain }]
          : [{ type: 'text', text: '' }],
      };
    }
  }
  return {
    type: 'paragraph',
    content: [{ type: 'text', text: extractPlainText(node) || '' }],
  };
}

export function contentfulToTiptap(json: Document | null | undefined): TiptapJSON {
  const doc = coerceRichTextDocument(json);
  if (!doc) {
    return {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    };
  }
  const content = (doc.content || []).map(mapCfBlockToPm);
  return {
    type: 'doc',
    content: content.length ? content : [{ type: 'paragraph' }],
  };
}

function findLinkHref(marks: unknown): string | null {
  if (!Array.isArray(marks)) return null;
  for (const m of marks) {
    if (!m || typeof m !== 'object') continue;
    const mm = m as { type?: string; attrs?: { href?: string } };
    if (mm.type === 'link' && typeof mm.attrs?.href === 'string') return mm.attrs.href;
  }
  return null;
}

function stripLinkMark(node: Record<string, unknown>): Record<string, unknown> {
  const marks = Array.isArray(node.marks)
    ? (node.marks as unknown[]).filter((m) => (m as { type?: string }).type !== 'link')
    : [];
  const next = { ...node };
  if (marks.length) next.marks = marks;
  else delete next.marks;
  return next;
}

function pmMarksToCf(marks: unknown): { type: string }[] {
  if (!Array.isArray(marks)) return [];
  const out: { type: string }[] = [];
  for (const m of marks) {
    if (!m || typeof m !== 'object') continue;
    const t = (m as { type?: string }).type;
    if (t === 'bold') out.push({ type: MARKS.BOLD });
    else if (t === 'italic') out.push({ type: MARKS.ITALIC });
    else if (t === 'underline') out.push({ type: MARKS.UNDERLINE });
    else if (t === 'code') out.push({ type: MARKS.CODE });
    else if (t === 'strike') out.push({ type: MARKS.STRIKETHROUGH });
  }
  return out;
}

function pmTextToCf(node: unknown, marksOverride?: unknown): Record<string, unknown> {
  if (!node || typeof node !== 'object') {
    return { ...EMPTY_TEXT_CF };
  }
  const n = node as Record<string, unknown>;
  const text = typeof n.text === 'string' ? n.text : '';
  const marks = pmMarksToCf(marksOverride ?? n.marks);
  return {
    nodeType: 'text',
    value: text,
    marks,
    data: {},
  };
}

function pmInlineFragmentsToCf(content: unknown): Record<string, unknown>[] {
  const arr = Array.isArray(content) ? content : [];
  const cf: Record<string, unknown>[] = [];
  let i = 0;
  while (i < arr.length) {
    const el = arr[i] as Record<string, unknown>;
    if (el.type === 'hardBreak') {
      cf.push({
        nodeType: 'text',
        value: '\n',
        marks: [],
        data: {},
      });
      i++;
      continue;
    }
    if (el.type === 'text') {
      const hrefRaw = findLinkHref(el.marks);
      const href = hrefRaw ? normalizeRichTextHyperlinkUri(hrefRaw) : '';
      if (href) {
        const group: Record<string, unknown>[] = [];
        while (i < arr.length) {
          const e = arr[i] as Record<string, unknown>;
          if (e.type !== 'text') break;
          const hRaw = findLinkHref(e.marks);
          const h = hRaw ? normalizeRichTextHyperlinkUri(hRaw) : '';
          if (h !== href) break;
          group.push(pmTextToCf(stripLinkMark(e)));
          i++;
        }
        cf.push({
          nodeType: INLINES.HYPERLINK,
          data: { uri: href },
          content: group.length ? group : [{ ...EMPTY_TEXT_CF }],
        });
        continue;
      }
      cf.push(pmTextToCf(el));
      i++;
      continue;
    }
    if (el.type === 'contentfulEntryInline') {
      const entryId = (el.attrs as { entryId?: string })?.entryId;
      if (typeof entryId === 'string' && entryId) {
        cf.push({
          nodeType: INLINES.EMBEDDED_ENTRY,
          content: [],
          data: { target: makeCfEntryLinkTarget(entryId) },
        });
      }
      i++;
      continue;
    }
    i++;
  }
  return cf.length ? cf : [{ ...EMPTY_TEXT_CF }];
}

function pmListItemToCf(node: unknown): Record<string, unknown> {
  if (!node || typeof node !== 'object') {
    return {
      nodeType: BLOCKS.LIST_ITEM,
      data: {},
      content: [emptyParagraphCf()],
    };
  }
  const n = node as Record<string, unknown>;
  const inner = Array.isArray(n.content) ? n.content : [];
  const blocks: Record<string, unknown>[] = [];
  for (const ch of inner) {
    blocks.push(pmBlockToCf(ch));
  }
  return {
    nodeType: BLOCKS.LIST_ITEM,
    data: {},
    content: blocks.length ? blocks : [emptyParagraphCf()],
  };
}

/** Prefer asset id embedded in Contentful CDN URLs (`…/SPACE/ASSET_ID/…`). */
function assetIdFromCtfImageUrl(src: string): string | null {
  if (!src.trim()) return null;
  try {
    const href = src.startsWith('//') ? `https:${src}` : src;
    const u = new URL(href);
    if (!u.hostname.includes('ctfassets.net')) return null;
    const seg = u.pathname.split('/').filter(Boolean);
    /** Same layout for images.*, downloads.*, preview CDN hosts: /{spaceId}/{assetId}/… */
    return seg.length >= 2 ? seg[1] ?? null : null;
  } catch {
    return null;
  }
}

/** Paragraphs are `inline*` in TipTap; DOM/HTML can still yield `paragraph > image`. Hoist to block siblings before CMA conversion. */
function flattenParagraphMixedContent(
  inlineContent: Record<string, unknown>[],
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  let buf: Record<string, unknown>[] = [];

  const flushPara = () => {
    if (buf.length === 0) return;
    out.push({ type: 'paragraph', content: buf });
    buf = [];
  };

  for (const n of inlineContent) {
    const nodeType = (n as { type?: string }).type;
    if (nodeType === 'image') {
      flushPara();
      out.push(n);
    } else {
      buf.push(n);
    }
  }
  flushPara();
  return out.length > 0 ? out : [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }];
}

function flattenPmBlock(block: Record<string, unknown>): Record<string, unknown>[] {
  const t = block.type as string | undefined;

  if (t === 'paragraph') {
    const inner = Array.isArray(block.content) ? (block.content as Record<string, unknown>[]) : [];
    const hasImg = inner.some((n) => (n as { type?: string }).type === 'image');
    if (!hasImg) return [block];
    return flattenParagraphMixedContent(inner);
  }

  if (t === 'heading') {
    const inner = Array.isArray(block.content) ? (block.content as Record<string, unknown>[]) : [];
    const hasImg = inner.some((n) => (n as { type?: string }).type === 'image');
    if (!hasImg) return [block];
    return flattenParagraphMixedContent(inner);
  }

  if (t === 'bulletList' || t === 'orderedList') {
    const items = Array.isArray(block.content) ? (block.content as Record<string, unknown>[]) : [];
    return [
      {
        ...block,
        content: items.map((li) => flattenListItemNode(li as Record<string, unknown>)),
      },
    ];
  }

  if (t === 'listItem') {
    return [flattenListItemNode(block)];
  }

  if (t === 'blockquote') {
    const inner = Array.isArray(block.content) ? (block.content as Record<string, unknown>[]) : [];
    return [{ ...block, content: inner.flatMap((ch) => flattenPmBlock(ch as Record<string, unknown>)) }];
  }

  if (t === 'table') {
    const rows = Array.isArray(block.content) ? (block.content as Record<string, unknown>[]) : [];
    return [
      {
        ...block,
        content: rows.map((row) => {
          if ((row as { type?: string }).type !== 'tableRow') return row;
          const r = row as Record<string, unknown>;
          const cells = Array.isArray(r.content) ? (r.content as Record<string, unknown>[]) : [];
          return {
            ...r,
            content: cells.map((cell) => {
              const c = cell as Record<string, unknown>;
              const innerCells = Array.isArray(c.content) ? (c.content as Record<string, unknown>[]) : [];
              return {
                ...c,
                content: innerCells.flatMap((ch) => flattenPmBlock(ch)),
              };
            }),
          };
        }),
      },
    ];
  }

  return [block];
}

function flattenListItemNode(li: Record<string, unknown>): Record<string, unknown> {
  const inner = Array.isArray(li.content) ? (li.content as Record<string, unknown>[]) : [];
  const flatInner = inner.flatMap((ch) => flattenPmBlock(ch as Record<string, unknown>));
  return {
    ...li,
    content: flatInner.length ? flatInner : [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
  };
}

function flattenPmDocRoot(pm: Record<string, unknown>): Record<string, unknown> {
  const raw = Array.isArray(pm.content) ? (pm.content as Record<string, unknown>[]) : [];
  const next = raw.flatMap((b) => flattenPmBlock(b));
  return { ...pm, content: next };
}

function pmBlockToCf(node: unknown): Record<string, unknown> {
  if (!node || typeof node !== 'object') {
    return emptyParagraphCf();
  }
  const n = node as Record<string, unknown>;
  const t = n.type;

  switch (t) {
    case 'paragraph':
      return {
        nodeType: BLOCKS.PARAGRAPH,
        data: {},
        content: pmInlineFragmentsToCf(n.content),
      };
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number((n.attrs as { level?: number })?.level) || 1));
      const nodeType = HEADING_CF[level - 1] ?? BLOCKS.HEADING_1;
      return {
        nodeType,
        data: {},
        content: pmInlineFragmentsToCf(n.content),
      };
    }
    case 'bulletList':
      return {
        nodeType: BLOCKS.UL_LIST,
        data: {},
        content: (Array.isArray(n.content) ? n.content : []).map(pmListItemToCf),
      };
    case 'orderedList':
      return {
        nodeType: BLOCKS.OL_LIST,
        data: {},
        content: (Array.isArray(n.content) ? n.content : []).map(pmListItemToCf),
      };
    case 'listItem':
      return pmListItemToCf(node);
    case 'horizontalRule':
      return { nodeType: BLOCKS.HR, data: {}, content: [] };
    case 'blockquote':
      return {
        nodeType: BLOCKS.QUOTE,
        data: {},
        content: (Array.isArray(n.content) ? n.content : []).map(pmBlockToCf),
      };
    case 'contentfulAsset': {
      const assetId = (n.attrs as { assetId?: string })?.assetId;
      if (typeof assetId === 'string' && assetId) {
        return {
          nodeType: BLOCKS.EMBEDDED_ASSET,
          content: [],
          data: { target: makeCfAssetLinkTarget(assetId) },
        };
      }
      return emptyParagraphCf();
    }
    case 'contentfulEntryBlock': {
      const entryId = (n.attrs as { entryId?: string })?.entryId;
      if (typeof entryId === 'string' && entryId) {
        return {
          nodeType: BLOCKS.EMBEDDED_ENTRY,
          content: [],
          data: { target: makeCfEntryLinkTarget(entryId) },
        };
      }
      return emptyParagraphCf();
    }
    case 'table':
      return {
        nodeType: BLOCKS.TABLE,
        data: {},
        content: (Array.isArray(n.content) ? n.content : []).map((row: unknown) => {
          const r = row as Record<string, unknown>;
          return {
            nodeType: BLOCKS.TABLE_ROW,
            data: {},
            content: (Array.isArray(r.content) ? r.content : []).map((cell: unknown) => {
              const c = cell as Record<string, unknown>;
              const isHeader = c.type === 'tableHeader';
              return {
                nodeType: isHeader ? BLOCKS.TABLE_HEADER_CELL : BLOCKS.TABLE_CELL,
                data: {},
                content: (Array.isArray(c.content) ? c.content : []).map(pmBlockToCf),
              };
            }),
          };
        }),
      };
    case 'image': {
      const src = String((n.attrs as { src?: string })?.src ?? '').trim();
      const aid = assetIdFromCtfImageUrl(src);
      if (aid) {
        return {
          nodeType: BLOCKS.EMBEDDED_ASSET,
          content: [],
          data: { target: makeCfAssetLinkTarget(aid) },
        };
      }
      return emptyParagraphCf();
    }
    default:
      return emptyParagraphCf();
  }
}

export function tiptapToContentful(pmJson: TiptapJSON | null | undefined): Document {
  if (!pmJson || typeof pmJson !== 'object' || pmJson.type !== 'doc') {
    return emptyContentfulDocument();
  }
  const flattened = flattenPmDocRoot(pmJson as Record<string, unknown>);
  const content = Array.isArray(flattened.content)
    ? (flattened.content as Record<string, unknown>[]).map(pmBlockToCf)
    : [];
  return {
    nodeType: BLOCKS.DOCUMENT,
    data: {},
    content: content.length ? content : [emptyParagraphCf()],
  } as Document;
}

export const RICH_TEXT_MAX_CHARS = 200_000;

export function collectAssetIdsFromContentfulDoc(doc: Document | null | undefined): string[] {
  const out = new Set<string>();
  function walk(n: unknown) {
    if (!n || typeof n !== 'object') return;
    const o = n as Record<string, unknown>;
    if (o.nodeType === BLOCKS.EMBEDDED_ASSET) {
      const id = extractAssetIdFromCfTarget(o.data);
      if (id) out.add(id);
    }
    const ch = o.content;
    if (Array.isArray(ch)) ch.forEach(walk);
    if (o.data && typeof o.data === 'object') walk((o.data as { target?: unknown }).target);
  }
  walk(doc);
  return [...out];
}

export function collectAssetIdsFromTiptapJson(pm: TiptapJSON | null | undefined): string[] {
  const out = new Set<string>();
  function walk(n: unknown) {
    if (!n || typeof n !== 'object') return;
    const o = n as Record<string, unknown>;
    if (o.type === 'contentfulAsset') {
      const id = (o.attrs as { assetId?: string })?.assetId;
      if (typeof id === 'string' && id) out.add(id);
    }
    const ch = o.content;
    if (Array.isArray(ch)) ch.forEach(walk);
  }
  walk(pm);
  return [...out];
}
