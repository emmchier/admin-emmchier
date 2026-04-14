'use client';

import type { UploadItem } from '@/lib/upload-types';
import { FileRow } from './FileRow';

type FileTableProps = {
  items: UploadItem[];
  allSelected: boolean;
  someSelected: boolean;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdateContentful: (
    id: string,
    patch: Partial<UploadItem['contentful']>,
  ) => void;
  publishingIds: Set<string>;
};

export function FileTable({
  items,
  allSelected,
  someSelected,
  onToggleSelectAll,
  onToggleSelect,
  onRemove,
  onUpdateContentful,
  publishingIds,
}: FileTableProps) {
  if (items.length === 0) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="upload-table-scroll min-h-0 flex-1 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50">
              <tr className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={(e) => onToggleSelectAll(e.target.checked)}
                    aria-label="Select all"
                    className="h-4 w-4 rounded border-neutral-300"
                  />
                </th>
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3 text-right">Size</th>
                <th className="px-3 py-3 text-right">Dimensions</th>
                <th className="px-3 py-3 text-right">Type</th>
                <th className="px-3 py-3">Title</th>
                <th className="px-3 py-3">Alt</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <FileRow
                  key={item.id}
                  item={item}
                  onToggleSelect={onToggleSelect}
                  onRemove={onRemove}
                  onUpdateContentful={onUpdateContentful}
                  publishingIds={publishingIds}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
