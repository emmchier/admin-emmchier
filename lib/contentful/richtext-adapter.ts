import { documentToHtmlString } from '@contentful/rich-text-html-renderer';
import type { Document } from '@contentful/rich-text-types';
import { BLOCKS, MARKS } from '@contentful/rich-text-types';

type Mark = { type: MARKS.BOLD | MARKS.ITALIC };

type TextNode = {
  nodeType: 'text';
  value: string;
  marks: Mark[];
  data: Record<string, never>;
};

function emptyDoc(): Document {
  return {
    nodeType: BLOCKS.DOCUMENT,
    data: {},
    content: [
      {
        nodeType: BLOCKS.PARAGRAPH,
        data: {},
        content: [{ nodeType: 'text', value: '', marks: [], data: {} }],
      } as any,
    ],
  };
}

function isDocument(v: unknown): v is Document {
  return (
    Boolean(v) &&
    typeof v === 'object' &&
    (v as any).nodeType === 'document' &&
    Array.isArray((v as any).content)
  );
}

export function contentfulToHtml(json: Document | null | undefined): string {
  if (!json) return '';
  if (!isDocument(json)) return '';
  try {
    return documentToHtmlString(json);
  } catch {
    return '';
  }
}

type Token =
  | { type: 'text'; value: string }
  | { type: 'tagOpen'; name: string }
  | { type: 'tagClose'; name: string }
  | { type: 'selfClose'; name: string };

function decodeEntities(input: string): string {
  return input
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

function stripTags(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

function tokenize(html: string): Token[] {
  const out: Token[] = [];
  const re = /<\/?[^>]+>|[^<]+/g;
  const parts = html.match(re) ?? [];
  for (const part of parts) {
    if (part.startsWith('<')) {
      const raw = part.slice(1, -1).trim();
      const isClose = raw.startsWith('/');
      const name = (isClose ? raw.slice(1) : raw).split(/\s+/)[0].toLowerCase();
      if (!name) continue;
      if (isClose) out.push({ type: 'tagClose', name });
      else if (raw.endsWith('/') || name === 'br') out.push({ type: 'selfClose', name });
      else out.push({ type: 'tagOpen', name });
    } else {
      out.push({ type: 'text', value: decodeEntities(part) });
    }
  }
  return out;
}

function makeText(value: string, marks: Mark[]): TextNode {
  return { nodeType: 'text', value, marks, data: {} };
}

function normalizeTextNodes(nodes: TextNode[]): TextNode[] {
  const out: TextNode[] = [];
  for (const n of nodes) {
    if (!n.value) continue;
    const prev = out[out.length - 1];
    if (prev && JSON.stringify(prev.marks) === JSON.stringify(n.marks)) prev.value += n.value;
    else out.push({ ...n });
  }
  return out;
}

function paragraphFromInline(inline: TextNode[]) {
  const content = normalizeTextNodes(inline);
  return {
    nodeType: BLOCKS.PARAGRAPH,
    data: {},
    content: content.length ? content : [makeText('', [])],
  };
}

/**
 * HTML -> Contentful Rich Text JSON (basic)
 * Supports: paragraphs, bold, italic, ul/ol/li, br
 * No embeds yet.
 */
export function htmlToContentful(html: string | null | undefined): Document {
  if (!html || !html.trim()) return emptyDoc();

  const tokens = tokenize(html);
  const docContent: any[] = [];

  let currentInline: TextNode[] = [];
  let inParagraph = false;

  let listMode: 'ul' | 'ol' | null = null;
  let currentListItems: any[] = [];
  let inListItem = false;
  let listItemInline: TextNode[] = [];

  const markStack: Mark[] = [];

  const flushParagraph = () => {
    docContent.push(paragraphFromInline(currentInline));
    currentInline = [];
    inParagraph = false;
  };

  const flushListItem = () => {
    const p = paragraphFromInline(listItemInline);
    currentListItems.push({ nodeType: BLOCKS.LIST_ITEM, data: {}, content: [p] });
    listItemInline = [];
    inListItem = false;
  };

  const flushList = () => {
    if (!listMode) return;
    if (inListItem) flushListItem();
    docContent.push({
      nodeType: listMode === 'ul' ? BLOCKS.UL_LIST : BLOCKS.OL_LIST,
      data: {},
      content: currentListItems,
    });
    currentListItems = [];
    listMode = null;
  };

  const pushText = (value: string) => {
    const v = value.replace(/\s+/g, (m) => (m.includes('\n') ? ' ' : m));
    if (!v) return;
    const marks = [...markStack];
    if (inListItem) listItemInline.push(makeText(v, marks));
    else currentInline.push(makeText(v, marks));
  };

  for (const t of tokens) {
    if (t.type === 'text') {
      pushText(t.value);
      continue;
    }

    if (t.type === 'selfClose') {
      if (t.name === 'br') pushText('\n');
      continue;
    }

    if (t.type === 'tagOpen') {
      if (t.name === 'p') {
        if (inParagraph && currentInline.length) flushParagraph();
        inParagraph = true;
        continue;
      }
      if (t.name === 'strong' || t.name === 'b') {
        markStack.push({ type: MARKS.BOLD });
        continue;
      }
      if (t.name === 'em' || t.name === 'i') {
        markStack.push({ type: MARKS.ITALIC });
        continue;
      }
      if (t.name === 'ul') {
        if (currentInline.length) flushParagraph();
        listMode = 'ul';
        continue;
      }
      if (t.name === 'ol') {
        if (currentInline.length) flushParagraph();
        listMode = 'ol';
        continue;
      }
      if (t.name === 'li') {
        inListItem = true;
        listItemInline = [];
        continue;
      }
      continue;
    }

    if (t.type === 'tagClose') {
      if (t.name === 'p') {
        flushParagraph();
        continue;
      }
      if (t.name === 'strong' || t.name === 'b') {
        for (let i = markStack.length - 1; i >= 0; i -= 1) {
          if (markStack[i].type === MARKS.BOLD) {
            markStack.splice(i, 1);
            break;
          }
        }
        continue;
      }
      if (t.name === 'em' || t.name === 'i') {
        for (let i = markStack.length - 1; i >= 0; i -= 1) {
          if (markStack[i].type === MARKS.ITALIC) {
            markStack.splice(i, 1);
            break;
          }
        }
        continue;
      }
      if (t.name === 'li') {
        flushListItem();
        continue;
      }
      if (t.name === 'ul' || t.name === 'ol') {
        flushList();
        continue;
      }
      continue;
    }
  }

  if (inListItem) flushListItem();
  if (listMode) flushList();
  if (currentInline.length) flushParagraph();

  if (docContent.length === 0) {
    const text = stripTags(html).trim();
    return {
      nodeType: BLOCKS.DOCUMENT,
      data: {},
      content: [paragraphFromInline(text ? [makeText(text, [])] : [])],
    } as any;
  }

  return { nodeType: BLOCKS.DOCUMENT, data: {}, content: docContent } as any;
}

