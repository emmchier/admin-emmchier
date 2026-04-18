'use client';

import * as React from 'react';
import type { Document, Block, Text } from '@contentful/rich-text-types';
import { BLOCKS, INLINES, MARKS } from '@contentful/rich-text-types';
import { documentToReactComponents, type Options } from '@contentful/rich-text-react-renderer';
import { contentfulService } from '@/services/contentfulService';
import { normalizeRichTextHyperlinkUri } from '@/lib/contentful/normalizeRichTextHyperlinkUri';

type Props = {
  value: Document | null | undefined;
  className?: string;
  managementApiRoot?: string;
};

function isText(node: unknown): node is Text {
  return Boolean(node) && typeof node === 'object' && (node as any).nodeType === 'text';
}

function safeText(node: unknown): string {
  return isText(node) ? String((node as any).value ?? '') : '';
}

function stripTags(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

function resolveAssetUrlFromNode(node: Block): string | null {
  const t: any = (node as any)?.data?.target;
  const file = t?.fields?.file;

  const directUrl = typeof file?.url === 'string' ? file.url : null;
  if (directUrl) return directUrl;

  const localized = file && typeof file === 'object' ? Object.values(file)[0] : null;
  const localizedUrl = typeof (localized as any)?.url === 'string' ? (localized as any).url : null;
  if (localizedUrl) return localizedUrl;

  return null;
}

function toAbsoluteCdnUrl(urlOrPath: string): string {
  if (!urlOrPath) return '';
  if (urlOrPath.startsWith('//')) return `https:${urlOrPath}`;
  return urlOrPath;
}

function collectEmbeddedAssetIds(node: any, out: Set<string>) {
  if (!node || typeof node !== 'object') return;
  if (node.nodeType === BLOCKS.EMBEDDED_ASSET) {
    const id = node?.data?.target?.sys?.id;
    if (typeof id === 'string' && id) out.add(id);
  }
  const content = Array.isArray(node.content) ? node.content : [];
  for (const c of content) collectEmbeddedAssetIds(c, out);
}

export function RichTextViewer({ value, className, managementApiRoot = '/api/contentful' }: Props) {
  const [assetUrlById, setAssetUrlById] = React.useState<Record<string, string | null>>({});

  React.useEffect(() => {
    let cancelled = false;
    if (!value || (value as any).nodeType !== 'document') return;

    const ids = new Set<string>();
    collectEmbeddedAssetIds(value as any, ids);
    const list = Array.from(ids);
    if (list.length === 0) return;

    (async () => {
      try {
        const space = contentfulService.inferSpaceFromManagementApiRoot(managementApiRoot);
        const items = await contentfulService.getAssetPreviews({ space, assetIds: list });
        const map: Record<string, string | null> = {};
        for (const it of items || []) {
          map[(it as any).assetId] = (it as any).url ?? null;
        }
        if (!cancelled) setAssetUrlById(map);
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [managementApiRoot, value]);

  const options = React.useMemo(
    () => ({
      renderMark: {
        [MARKS.BOLD]: (text) => <strong>{text}</strong>,
        [MARKS.ITALIC]: (text) => <em>{text}</em>,
        [MARKS.UNDERLINE]: (text) => <u>{text}</u>,
      },
      renderNode: {
        [BLOCKS.PARAGRAPH]: (_node, children) => (
          <p className="my-3 whitespace-pre-line leading-7">{children}</p>
        ),
        [BLOCKS.HEADING_1]: (_node, children) => <h1 className="my-4 text-2xl font-semibold">{children}</h1>,
        [BLOCKS.HEADING_2]: (_node, children) => <h2 className="my-4 text-xl font-semibold">{children}</h2>,
        [BLOCKS.HEADING_3]: (_node, children) => <h3 className="my-3 text-lg font-semibold">{children}</h3>,
        [BLOCKS.HEADING_4]: (_node, children) => <h4 className="my-3 text-base font-semibold">{children}</h4>,

        [BLOCKS.UL_LIST]: (_node, children) => <ul className="my-3 list-disc pl-6">{children}</ul>,
        [BLOCKS.OL_LIST]: (_node, children) => <ol className="my-3 list-decimal pl-6">{children}</ol>,
        [BLOCKS.LIST_ITEM]: (_node, children) => <li className="my-1">{children}</li>,

        [INLINES.HYPERLINK]: (node, children) => {
          const raw =
            typeof (node as any)?.data?.uri === 'string' ? ((node as any).data.uri as string) : '';
          const href = raw ? normalizeRichTextHyperlinkUri(raw) : '';
          if (!href) return <span>{children}</span>;
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {children}
            </a>
          );
        },

        [BLOCKS.EMBEDDED_ASSET]: (node: any) => {
          const urlOrPath = resolveAssetUrlFromNode(node);
          const id = node?.data?.target?.sys?.id;
          const resolved = !urlOrPath && typeof id === 'string' ? assetUrlById[id] : null;
          const src = urlOrPath ? toAbsoluteCdnUrl(urlOrPath) : resolved ? toAbsoluteCdnUrl(resolved) : '';
          if (!src) return null;

          return (
            <figure className="my-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-auto max-w-full rounded-md border border-zinc-200" loading="lazy" />
            </figure>
          );
        },
      },
      renderText: (text) => (typeof text === 'string' ? text : String(text ?? '')),
    }),
    [assetUrlById],
  ) as Options;

  if (!value || (value as any).nodeType !== 'document') return null;

  try {
    return <div className={className}>{documentToReactComponents(value, options)}</div>;
  } catch {
    // ultra-safe fallback: plain text
    const content = Array.isArray((value as any).content) ? (value as any).content : [];
    const text = stripTags(content.map(safeText).join(' ')).trim();
    return text ? <div className={className}>{text}</div> : null;
  }
}

