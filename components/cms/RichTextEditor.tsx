'use client';

import * as React from 'react';
import type { Editor } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Document } from '@contentful/rich-text-types';
import {
  Bold,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  PilcrowSquare,
  Quote,
  Strikethrough,
  Table as TableIcon,
  Underline as UnderlineIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { coerceRichTextDocument } from '@/lib/contentful/coerceRichTextDocument';
import { contentfulToHTML } from '@/lib/contentful/contentfulToHTML';
import { contentfulService } from '@/services/contentfulService';
import { RICH_TEXT_MAX_CHARS } from '@/lib/contentful/contentfulTiptapBridge';
import { getRichTextEditorExtensions } from '@/lib/contentful/richTextTiptapExtensions';
import { enrichRichTextDocumentWithAssetUrls } from '@/lib/contentful/enrichRichTextAssetUrls';
import { toast } from '@/hooks/use-toast';

export type RichTextEditorProps = {
  /** Contentful Rich Text JSON (object) until the user edits; then session HTML string. */
  value: Document | string | null | undefined;
  /** Temporary save path: editor HTML until reverse conversion exists. */
  onChange: (nextHtml: string) => void;
  className?: string;
  disabled?: boolean;
  helperText?: string;
  managementApiRoot?: string;
};

function deriveHtmlFromValue(
  value: Document | string | null | undefined
): string {
  if (typeof value === 'string') {
    const t = value.trim();
    return t.length > 0 ? value : '<p></p>';
  }
  const doc = coerceRichTextDocument(value);
  if (!doc) return '<p></p>';
  return contentfulToHTML(doc);
}

export function RichTextEditor({
  value,
  onChange,
  className,
  disabled,
  helperText,
  managementApiRoot = '/api/contentful',
}: RichTextEditorProps) {
  const baselineHtmlRef = React.useRef<string | null>(null);
  /** Block `onChange` during programmatic `setContent` (asset hydration / baseline sync) so the project store does not go dirty on open. */
  const suppressOnChangeRef = React.useRef(true);

  /** Initial TipTap HTML — capture once per mount so `useEditor` does not reset when `value` becomes session HTML. */
  const mountHtmlRef = React.useRef<string | null>(null);
  if (mountHtmlRef.current === null) {
    mountHtmlRef.current = deriveHtmlFromValue(value);
  }

  /** Stable fingerprint so Contentful JSON updates resync without depending on object identity each render. */
  const syncSource = React.useMemo(() => {
    if (typeof value === 'string') return '__session_html__';
    const doc = coerceRichTextDocument(value);
    return JSON.stringify(doc ?? null);
  }, [value]);

  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const editorRef = React.useRef<Editor | null>(null);
  const managementApiRootRef = React.useRef(managementApiRoot);
  managementApiRootRef.current = managementApiRoot;

  const [selectionTick, setSelectionTick] = React.useState(0);

  /** Same `/api/upload` pipeline as gallery (Sharp → WebP, max width). Shared by toolbar, paste, and drop. */
  const uploadImageFile = React.useCallback(async (file: File) => {
    const ed = editorRef.current;
    if (!ed || ed.isDestroyed || !file.type.startsWith('image/')) return;
    const space =
      contentfulService.inferSpaceFromManagementApiRoot(managementApiRootRef.current);
    const form = new FormData();
    form.set('file', file);
    form.set('title', file.name.replace(/\.\w+$/, '') || 'image');
    form.set('alt', file.name.replace(/\.\w+$/, '') || 'image');
    const xhr = new XMLHttpRequest();
    try {
      const json = await new Promise<{ assetId?: string; url?: string; error?: string }>(
        (resolve, reject) => {
          xhr.open('POST', `/api/upload?space=${encodeURIComponent(space)}`);
          xhr.responseType = 'json';
          xhr.onload = () => {
            if (xhr.status < 200 || xhr.status >= 300) {
              reject(
                new Error(
                  (xhr.response as { error?: string })?.error || 'Upload failed'
                )
              );
              return;
            }
            resolve(xhr.response as { assetId?: string; url?: string });
          };
          xhr.onerror = () => reject(new Error('Upload failed'));
          xhr.send(form);
        }
      );
      const previewSrc = typeof json.url === 'string' ? json.url : '';
      if (!previewSrc) return;
      ed.chain().focus().setImage({ src: previewSrc }).run();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Upload failed';
      toast({
        variant: 'destructive',
        title: 'No se pudo subir la imagen',
        description: message,
      });
    }
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: getRichTextEditorExtensions(),
    content: mountHtmlRef.current ?? '<p></p>',
    editable: !disabled,
    editorProps: {
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (let i = 0; i < items.length; i += 1) {
          const item = items[i];
          if (item.kind === 'file' && item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              event.preventDefault();
              void uploadImageFile(file);
              return true;
            }
          }
        }
        return false;
      },
      handleDrop: (_view, event, _slice, moved) => {
        if (moved) return false;
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        const images = Array.from(files).filter((f) => f.type.startsWith('image/'));
        if (images.length === 0) return false;
        event.preventDefault();
        void (async () => {
          for (const f of images) {
            await uploadImageFile(f);
          }
        })();
        return true;
      },
      attributes: {
        class: cn(
          'min-h-[200px] px-3 py-2 text-[18px] text-neutral-900 outline-none',
          'focus:outline-none',
          '[&_p]:my-2 [&_p]:leading-relaxed',
          '[&_h1]:my-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:leading-tight',
          '[&_h2]:my-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-tight',
          '[&_h3]:my-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:leading-tight',
          '[&_h4]:my-2 [&_h4]:text-base [&_h4]:font-semibold',
          '[&_h5]:my-2 [&_h5]:text-sm [&_h5]:font-semibold',
          '[&_h6]:my-2 [&_h6]:text-sm [&_h6]:font-medium',
          '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6',
          '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6',
          '[&_li]:my-0.5',
          '[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-neutral-300 [&_blockquote]:pl-4 [&_blockquote]:text-neutral-700',
          '[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-neutral-200',
          '[&_td]:border [&_td]:border-neutral-200 [&_td]:px-2 [&_td]:py-1',
          '[&_th]:border [&_th]:border-neutral-200 [&_th]:px-2 [&_th]:py-1 [&_th]:bg-neutral-50',
          '[&_img]:my-3 [&_img]:max-h-80 [&_img]:rounded-md'
        ),
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (suppressOnChangeRef.current) return;
      const html = ed.getHTML();
      if (baselineHtmlRef.current !== null) {
        if (html === baselineHtmlRef.current) return;
        baselineHtmlRef.current = null;
      }
      onChangeRef.current(html);
    },
  });

  /** Avoid StrictMode / fast navigation applying stale enriched HTML after a newer load. */
  const assetHydrationGenRef = React.useRef(0);

  /**
   * CMA returns embedded assets as unresolved Links → `documentToHtmlString` emits `<img src="">`.
   * Resolve CDN URLs (`contentfulService`) and sync editor so images survive load → save round-trips.
   */
  React.useEffect(() => {
    if (!editor) return;
    if (typeof value === 'string') return;
    const doc = coerceRichTextDocument(value);
    /**
     * Without a document there is no async enrich — but `suppressOnChangeRef` starts `true`,
     * so we must release it or typing never reaches the form store (`Save` stays disabled).
     */
    if (!doc) {
      queueMicrotask(() => {
        if (!editor.isDestroyed) suppressOnChangeRef.current = false;
      });
      return;
    }

    suppressOnChangeRef.current = true;
    const gen = ++assetHydrationGenRef.current;
    const space =
      contentfulService.inferSpaceFromManagementApiRoot(managementApiRoot);

    void (async () => {
      try {
        const enriched = await enrichRichTextDocumentWithAssetUrls(doc, space);
        if (gen !== assetHydrationGenRef.current || editor.isDestroyed) return;
        const html = contentfulToHTML(enriched);
        editor.commands.setContent(html, { emitUpdate: false });
        baselineHtmlRef.current = editor.getHTML();
      } finally {
        if (gen === assetHydrationGenRef.current && !editor.isDestroyed) {
          queueMicrotask(() => {
            if (!editor.isDestroyed) suppressOnChangeRef.current = false;
          });
        }
      }
    })();
  }, [editor, syncSource, managementApiRoot, value]);

  /** Session-HTML mode (no async enrich): release suppress once the editor instance exists. */
  React.useEffect(() => {
    if (!editor) return;
    if (typeof value !== 'string') return;
    suppressOnChangeRef.current = true;
    baselineHtmlRef.current = editor.getHTML();
    queueMicrotask(() => {
      if (!editor.isDestroyed) suppressOnChangeRef.current = false;
    });
  }, [editor, value]);

  React.useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  React.useEffect(() => {
    if (!editor) return;
    const bump = () => setSelectionTick((x: number) => x + 1);
    editor.on('selectionUpdate', bump);
    editor.on('transaction', bump);
    return () => {
      editor.off('selectionUpdate', bump);
      editor.off('transaction', bump);
    };
  }, [editor, setSelectionTick]);

  React.useEffect(() => {
    if (editor) editorRef.current = editor;
    return () => {
      editorRef.current = null;
    };
  }, [editor]);

  const charCount = editor?.getText().length ?? 0;

  const blockStyleSelectValue = React.useMemo(() => {
    void selectionTick; // re-run when selection/transaction updates (toolbar heading state)
    if (!editor) return 'paragraph';
    for (let level = 1; level <= 6; level++) {
      if (editor.isActive('heading', { level })) return `h${level}`;
    }
    return 'paragraph';
  }, [editor, selectionTick]);

  const runLink = React.useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const href = window.prompt('URL del enlace', prev ?? 'https://');
    if (href === null) return;
    const t = href.trim();
    if (t === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: t }).run();
  }, [editor]);

  const onBlockStyleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (!editor) return;
      const next = e.target.value;
      if (next === 'paragraph') {
        editor.chain().focus().setParagraph().run();
        return;
      }
      const level = Number(next.replace(/^h/, '')) as 1 | 2 | 3 | 4 | 5 | 6;
      editor.chain().focus().setParagraph().toggleHeading({ level }).run();
    },
    [editor]
  );

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-neutral-200 bg-white',
        className
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void uploadImageFile(f);
        }}
      />
      {editor ? (
        <>
          <div className="flex max-h-[42vh] flex-wrap items-center gap-0.5 overflow-y-auto border-b border-neutral-200 bg-neutral-50/80 px-2 py-1.5">
            <select
              value={blockStyleSelectValue}
              onChange={onBlockStyleChange}
              disabled={disabled}
              className="h-8 min-w-[148px] max-w-[min(220px,40vw)] rounded-md border border-neutral-200 bg-white pl-3 pr-8 text-xs font-medium text-neutral-800"
              aria-label="Estilo de párrafo o encabezado"
            >
              <option value="paragraph">Paragraph</option>
              {[1, 2, 3, 4, 5, 6].map((level) => (
                <option key={level} value={`h${level}`}>
                  Heading {level}
                </option>
              ))}
            </select>
            <span className="mx-1 h-4 w-px bg-neutral-200" aria-hidden />
            <Button
              type="button"
              variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              disabled={disabled}
              aria-label="Bold"
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              disabled={disabled}
              aria-label="Italic"
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={editor.isActive('underline') ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              disabled={disabled}
              aria-label="Underline"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              <UnderlineIcon className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={editor.isActive('strike') ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              disabled={disabled}
              aria-label="Strikethrough"
              onClick={() => editor.chain().focus().toggleStrike().run()}
            >
              <Strikethrough className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={editor.isActive('code') ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              disabled={disabled}
              aria-label="Code"
              onClick={() => editor.chain().focus().toggleCode().run()}
            >
              <PilcrowSquare className="h-4 w-4" />
            </Button>
            <span className="mx-1 h-4 w-px bg-neutral-200" aria-hidden />
            <Button
              type="button"
              variant={editor.isActive('link') ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              disabled={disabled}
              aria-label="Link"
              onClick={() => runLink()}
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
            <span className="mx-1 h-4 w-px bg-neutral-200" aria-hidden />
            <Button
              type="button"
              variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              disabled={disabled}
              aria-label="Bullet list"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              disabled={disabled}
              aria-label="Ordered list"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={editor.isActive('blockquote') ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              disabled={disabled}
              aria-label="Quote"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
              <Quote className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={disabled}
              aria-label="Horizontal rule"
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={disabled}
              aria-label="Insert table"
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                  .run()
              }
            >
              <TableIcon className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={disabled}
              aria-label="Insert image"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" />
            </Button>
          </div>
          <EditorContent editor={editor} />
          <div className="flex justify-between gap-3 border-t border-neutral-200 px-3 py-2 text-xs text-neutral-500">
            <span>{charCount} caracteres</span>
            <span>
              Máximo {RICH_TEXT_MAX_CHARS.toLocaleString()} caracteres
            </span>
          </div>
          {helperText ? (
            <p className="border-t border-neutral-100 px-3 py-2 text-xs text-neutral-500">
              {helperText}
            </p>
          ) : null}
        </>
      ) : (
        <div
          className="min-h-[240px] animate-pulse bg-neutral-50"
          aria-hidden
        />
      )}
    </div>
  );
}
