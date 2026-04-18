import { mergeAttributes, Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';

export function extractAssetIdFromCfTarget(data: unknown): string | null {
  const t = (data as { target?: { sys?: { id?: string; linkType?: string } } })?.target;
  const id = t?.sys?.id;
  return typeof id === 'string' && id ? id : null;
}

export function extractEntryIdFromCfTarget(data: unknown): string | null {
  return extractAssetIdFromCfTarget(data);
}

export function makeCfAssetLinkTarget(assetId: string) {
  return {
    sys: {
      type: 'Link',
      linkType: 'Asset',
      id: assetId,
    },
  };
}

export function makeCfEntryLinkTarget(entryId: string) {
  return {
    sys: {
      type: 'Link',
      linkType: 'Entry',
      id: entryId,
    },
  };
}

function AssetNodeView(props: {
  node: { attrs: { assetId?: string | null; previewSrc?: string | null } };
}) {
  const { assetId, previewSrc } = props.node.attrs;
  const src = previewSrc || '';
  return (
    <NodeViewWrapper className="my-3" data-drag-handle="">
      <figure className="overflow-hidden rounded-md border border-neutral-200 bg-neutral-50">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-auto max-h-[480px] w-full object-contain" draggable={false} />
        ) : (
          <div className="flex min-h-[120px] items-center justify-center px-4 py-8 text-xs text-neutral-500">
            {assetId ? `Imagen (${assetId.slice(0, 8)}…)` : 'Imagen'}
          </div>
        )}
      </figure>
    </NodeViewWrapper>
  );
}

function EntryBlockNodeView(props: {
  node: { attrs: { entryId?: string | null } };
}) {
  const id = props.node.attrs.entryId ?? '';
  return (
    <NodeViewWrapper className="my-3 rounded-md border border-dashed border-amber-300 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
      Entrada incrustada {id ? `(ID: ${id})` : ''} — edita el detalle en Contentful si hace falta.
    </NodeViewWrapper>
  );
}

function EntryInlineNodeView(props: {
  node: { attrs: { entryId?: string | null } };
}) {
  const id = props.node.attrs.entryId ?? '';
  return (
    <NodeViewWrapper as="span" className="inline rounded border border-amber-200 bg-amber-50 px-1 py-0.5 text-xs text-amber-900">
      ⌗{id ? id.slice(0, 8) : '…'}
    </NodeViewWrapper>
  );
}

export const ContentfulEmbeddedAsset = Node.create({
  name: 'contentfulAsset',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      assetId: { default: null },
      previewSrc: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="contentful-asset"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'contentful-asset' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AssetNodeView);
  },
});

export const ContentfulEmbeddedEntryBlock = Node.create({
  name: 'contentfulEntryBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      entryId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="contentful-entry-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'contentful-entry-block' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EntryBlockNodeView);
  },
});

export const ContentfulEmbeddedEntryInline = Node.create({
  name: 'contentfulEntryInline',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      entryId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="contentful-entry-inline"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'contentful-entry-inline' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EntryInlineNodeView);
  },
});
