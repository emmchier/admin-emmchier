'use client';

import type { Document } from '@contentful/rich-text-types';
import { BLOCKS } from '@contentful/rich-text-types';
import type { SpaceId } from '@/lib/spaces';
import { contentfulService } from '@/services/contentfulService';
import { extractAssetIdFromCfTarget } from '@/lib/contentful/tiptapContentfulNodes';

function isUnexpandedAssetLink(data: unknown): boolean {
  const sys = (data as { target?: { sys?: { type?: string; linkType?: string } } })?.target?.sys;
  const lt = String(sys?.linkType ?? '').toLowerCase();
  return sys?.type === 'Link' && lt === 'asset';
}

/** Shape expected by `@contentful/rich-text-html-renderer` `defaultBlockAsset` (`fields.file.url`). */
function syntheticExpandedAsset(assetId: string, absoluteUrl: string) {
  return {
    sys: { type: 'Asset', id: assetId },
    fields: {
      description: '',
      file: {
        url: absoluteUrl,
      },
    },
  };
}

function cloneDocument(doc: Document): Document {
  return JSON.parse(JSON.stringify(doc)) as Document;
}

function collectUnexpandedAssetIds(nodes: unknown[]): Set<string> {
  const ids = new Set<string>();
  function walk(arr: unknown[]) {
    for (const node of arr) {
      if (!node || typeof node !== 'object') continue;
      const n = node as Record<string, unknown>;
      if (n.nodeType === BLOCKS.EMBEDDED_ASSET && isUnexpandedAssetLink(n.data)) {
        const id = extractAssetIdFromCfTarget(n.data);
        if (id) ids.add(id);
      }
      if (Array.isArray(n.content)) walk(n.content as unknown[]);
    }
  }
  walk(nodes);
  return ids;
}

function patchAssetTargets(nodes: unknown[], urlById: Record<string, string>): void {
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    const n = node as Record<string, unknown>;
    if (n.nodeType === BLOCKS.EMBEDDED_ASSET && isUnexpandedAssetLink(n.data)) {
      const id = extractAssetIdFromCfTarget(n.data);
      const url = id ? urlById[id] : undefined;
      if (id && url) {
        n.data = { target: syntheticExpandedAsset(id, url) };
      }
    }
    if (Array.isArray(n.content)) patchAssetTargets(n.content as unknown[], urlById);
  }
}

/**
 * Management API entries usually reference assets as unresolved Links, so `documentToHtmlString`
 * renders `<img src="">`. Resolve CDN URLs via our assets API and patch the tree so HTML → TipTap keeps images.
 */
export async function enrichRichTextDocumentWithAssetUrls(
  doc: Document,
  space: SpaceId,
): Promise<Document> {
  const ids = collectUnexpandedAssetIds(doc.content as unknown[]);
  if (ids.size === 0) return doc;

  const previews = await contentfulService.getAssetPreviews({
    space,
    assetIds: [...ids],
  });
  const urlById: Record<string, string> = {};
  for (const p of previews) {
    if (p.url) urlById[p.assetId] = p.url;
  }

  const out = cloneDocument(doc);
  patchAssetTargets(out.content as unknown[], urlById);
  return out;
}
