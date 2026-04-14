'use client';

import type { UploadItem } from '@/lib/upload-types';
import { formatKb } from '@/lib/upload-helpers';
import { OriginalPreviewImage } from './OriginalPreviewImage';
import type { PreviewOpenRequest } from './preview-types';

type ConvertedPanelProps = {
  items: UploadItem[];
  onOpenPreview: (request: PreviewOpenRequest) => void;
};

export function ConvertedPanel({ items, onOpenPreview }: ConvertedPanelProps) {
  const converted = items.filter((i) => i.status === 'converted' && i.processed);

  if (converted.length === 0) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center">
        <p className="text-sm font-medium text-neutral-700">No converted previews yet</p>
        <p className="mt-2 max-w-xs text-xs text-neutral-500">
          Run Convert on your queue to compare originals with processed WebP assets.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Converted images
      </h2>
      <ul className="flex flex-col gap-4">
        {converted.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-300"
          >
            <p className="mb-3 truncate text-base font-medium text-neutral-900">{item.file.name}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <p className="text-xs font-medium text-neutral-500">Original</p>
                <button
                  type="button"
                  className="relative flex max-h-52 cursor-zoom-in items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 text-left"
                  onClick={() =>
                    onOpenPreview({
                      kind: 'original',
                      file: item.file,
                      alt: item.file.name,
                    })
                  }
                >
                  <OriginalPreviewImage file={item.file} label={item.file.name} />
                </button>
                <p className="text-xs text-neutral-600">
                  {formatKb(item.original.size)} · {item.original.width}×{item.original.height}
                </p>
              </div>
              <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <p className="text-xs font-medium text-neutral-500">Processed</p>
                <button
                  type="button"
                  className="relative flex max-h-52 cursor-zoom-in items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 text-left"
                  onClick={() => {
                    if (item.processed) {
                      onOpenPreview({
                        kind: 'processed',
                        url: item.processed.url,
                        alt: item.contentful.alt.trim() || item.file.name,
                      });
                    }
                  }}
                >
                  {item.processed ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={item.processed.url}
                      alt={item.contentful.alt.trim() || item.file.name}
                      className="max-h-48 w-full object-contain"
                    />
                  ) : null}
                </button>
                <p className="text-xs text-neutral-600">
                  {item.processed
                    ? `${formatKb(item.processed.size)} · ${item.processed.width}×${item.processed.height}`
                    : ''}
                </p>
              </div>
            </div>
            {item.published ? (
              <p className="mt-3 text-xs text-neutral-600">
                CDN:{' '}
                <a
                  href={item.published.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-blue-600 underline"
                >
                  {item.published.url}
                </a>
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
