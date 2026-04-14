'use client';

import type { RefObject } from 'react';

type DropzoneProps = {
  onPickFiles: (files: FileList | File[]) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  variant?: 'empty' | 'compact';
};

const ACCEPT =
  'image/png,image/jpeg,image/jpg,image/webp,image/tiff' as const;

export function Dropzone({ onPickFiles, fileInputRef, variant = 'compact' }: DropzoneProps) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files?.length) {
      onPickFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const list = e.target.files;
          if (list?.length) onPickFiles(list);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={
          variant === 'empty'
            ? 'group flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 bg-white px-6 py-16 text-center transition hover:border-neutral-400 hover:bg-neutral-50'
            : 'group flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-neutral-300 bg-white px-4 py-6 text-center transition hover:border-neutral-400 hover:bg-neutral-50'
        }
      >
        <span className="text-base font-medium text-neutral-800">Drag &amp; drop images</span>
        <span className="text-sm text-neutral-500">or click to upload</span>
        {variant === 'empty' ? (
          <span className="mt-2 text-xs text-neutral-500">
            Supported formats: PNG, JPG, JPEG, WEBP, TIFF
          </span>
        ) : null}
      </button>
    </div>
  );
}
