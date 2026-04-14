'use client';

import { Spinner } from '@/components/ui/Spinner';

type ToolbarProps = {
  onConvert: () => void;
  onUpload: () => void;
  onClear: () => void;
  onDeleteSelected: () => void;
  isConverting: boolean;
  isUploadingToCMS: boolean;
  hasItems: boolean;
  someSelected: boolean;
  selectedCount: number;
  canConvert: boolean;
  canUpload: boolean;
};

export function Toolbar({
  onConvert,
  onUpload,
  onClear,
  onDeleteSelected,
  isConverting,
  isUploadingToCMS,
  hasItems,
  someSelected,
  selectedCount,
  canConvert,
  canUpload,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-neutral-200 bg-white p-2">
      <button
        type="button"
        onClick={onConvert}
        disabled={!canConvert || isConverting}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isConverting && <Spinner className="h-3.5 w-3.5 text-white" />}
        {isConverting ? 'Converting…' : 'Convert'}
      </button>
      <button
        type="button"
        onClick={onUpload}
        disabled={isUploadingToCMS || !canUpload}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 transition hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isUploadingToCMS && <Spinner className="h-3.5 w-3.5" />}
        {isUploadingToCMS ? 'Uploading…' : 'Upload to database'}
      </button>
      <button
        type="button"
        onClick={onClear}
        disabled={!hasItems}
        className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Clear
      </button>
      <button
        type="button"
        onClick={onDeleteSelected}
        disabled={!someSelected}
        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Delete selected
        {selectedCount > 0 ? ` (${selectedCount})` : ''}
      </button>
    </div>
  );
}
