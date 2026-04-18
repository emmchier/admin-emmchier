import type { Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { ListItem } from '@tiptap/extension-list';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';

/**
 * Default list item is `paragraph block*` (paragraph must be first). Contentful often emits
 * `<li><p>…</p><img/><p>…</p>` which browsers parse fine but ProseMirror can reject `image`
 * between blocks. Allow any blocks so embedded assets survive HTML → TipTap.
 */
const ListItemWithEmbeds = ListItem.extend({
  content: 'block+',
});

/** Shared schema for RichTextEditor and HTML → Contentful conversion (must stay in sync). */
export function getRichTextEditorExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      codeBlock: false,
      /** We register our own Link + ListItem below (avoid duplicates / wrong list schema). */
      link: false,
      listItem: false,
    }),
    ListItemWithEmbeds,
    Underline,
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-primary underline underline-offset-2',
      },
    }),
    Image.configure({
      HTMLAttributes: { class: 'max-h-80 rounded-md border border-neutral-200' },
    }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
  ];
}
