'use client';

import type { UploadItem } from '@/lib/upload-types';
import { formatKb } from '@/lib/upload-helpers';
import { Spinner } from '@/components/ui/Spinner';

type FileRowProps = {
  item: UploadItem;
  onToggleSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdateContentful: (
    id: string,
    patch: Partial<UploadItem['contentful']>
  ) => void;
  publishingIds: Set<string>;
};

export function FileRow({
  item,
  onToggleSelect,
  onRemove,
  onUpdateContentful,
  publishingIds,
}: FileRowProps) {
  return (
    <tr className="border-b border-neutral-100 transition hover:bg-neutral-50/80">
      <td className="w-10 px-3 py-3 align-top">
        <div className="pt-0.5">
          <input
            type="checkbox"
            checked={item.selected}
            onChange={() => onToggleSelect(item.id)}
            aria-label={`Select ${item.file.name}`}
            className="h-4 w-4 rounded border-neutral-300"
          />
        </div>
      </td>
      <td className="max-w-[220px] min-w-[140px] px-3 py-3 align-top">
        <p className="mb-2 truncate text-base font-medium text-neutral-900">
          {item.file.name}
        </p>
        {item.status === 'error' && item.errorMessage ? (
          <p className="text-xs text-red-600">{item.errorMessage}</p>
        ) : null}
        {item.published ? (
          <p className="mt-1 text-xs text-emerald-700">
            Published · entry{' '}
            <span className="font-mono text-[11px]">
              {item.published.entryId}
            </span>
          </p>
        ) : null}
      </td>
      <td className="whitespace-nowrap px-3 py-3 align-top text-right text-sm tabular-nums text-neutral-700">
        {formatKb(item.original.size)}
      </td>
      <td className="whitespace-nowrap px-3 py-3 align-top text-right text-sm tabular-nums text-neutral-700">
        {item.original.width}×{item.original.height}
      </td>
      <td className="whitespace-nowrap px-3 py-3 align-top text-right text-sm text-neutral-700">
        {item.original.type}
      </td>
      <td className="min-w-[140px] max-w-[200px] px-3 py-3 align-top">
        <label className="flex flex-col gap-1">
          <span className="sr-only">Title</span>
          <input
            value={item.contentful.title}
            onChange={(e) =>
              onUpdateContentful(item.id, { title: e.target.value })
            }
            className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-900 outline-none focus-visible:border-neutral-400 focus-visible:outline focus-visible:outline-offset-0 focus-visible:outline-neutral-400"
            placeholder="Title"
            aria-label={`Title for ${item.file.name}`}
          />
        </label>
      </td>
      <td className="min-w-[140px] max-w-[220px] px-3 py-3 align-top">
        <label className="flex flex-col gap-1">
          <span className="sr-only">Alt</span>
          <input
            value={item.contentful.alt}
            onChange={(e) =>
              onUpdateContentful(item.id, { alt: e.target.value })
            }
            className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-900 outline-none focus-visible:border-neutral-400 focus-visible:outline focus-visible:outline-offset-0 focus-visible:outline-neutral-400"
            placeholder="Alt text"
            aria-label={`Alt text for ${item.file.name}`}
          />
        </label>
      </td>
      <td className="whitespace-nowrap px-3 py-3 align-top">
        <div className="flex items-center justify-end gap-2">
          {item.status === 'converting' && <Spinner />}
          {publishingIds.has(item.id) && <Spinner />}
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
