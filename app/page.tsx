'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';

type UploadItem = {
  id: string;
  file: File;
  original: {
    size: number;
    width: number;
    height: number;
    type: string;
  };
  processed?: {
    blob: Blob;
    url: string;
    size: number;
    width: number;
    height: number;
  };
  status: 'idle' | 'converting' | 'converted' | 'error';
  selected: boolean;
  published?: { assetId: string; url: string };
  errorMessage?: string;
};

type ConvertSuccess = {
  base64: string;
  mimeType: string;
  originalSize: number;
  processedSize: number;
  width: number;
  height: number;
};

type PublishSuccess = {
  assetId: string;
  url: string;
  originalSize: number;
  processedSize: number;
};

function isConvertSuccess(data: unknown): data is ConvertSuccess {
  if (typeof data !== 'object' || data === null) return false;
  const o = data as Record<string, unknown>;
  return (
    typeof o.base64 === 'string' &&
    typeof o.mimeType === 'string' &&
    typeof o.originalSize === 'number' &&
    typeof o.processedSize === 'number' &&
    typeof o.width === 'number' &&
    typeof o.height === 'number'
  );
}

function isPublishSuccess(data: unknown): data is PublishSuccess {
  if (typeof data !== 'object' || data === null) return false;
  const o = data as Record<string, unknown>;
  return (
    typeof o.assetId === 'string' &&
    typeof o.url === 'string' &&
    typeof o.originalSize === 'number' &&
    typeof o.processedSize === 'number'
  );
}

function readJsonError(data: unknown): string {
  if (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof (data as { error: unknown }).error === 'string'
  ) {
    return (data as { error: string }).error;
  }
  return 'Request failed';
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read image dimensions'));
    };
    img.src = objectUrl;
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function fileKindLabel(mime: string): string {
  const t = mime.replace(/^image\//i, '').toLowerCase();
  return t || 'image';
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className ?? 'h-4 w-4 text-neutral-500'}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export default function Home() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishingIds, setPublishingIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const convertBusyRef = useRef(false);
  const publishBusyRef = useRef(false);

  const revokeProcessed = useCallback((item: UploadItem) => {
    if (item.processed?.url) URL.revokeObjectURL(item.processed.url);
  }, []);

  const addFilesFromList = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;

    setGlobalError(null);
    const next: UploadItem[] = [];
    for (const file of files) {
      try {
        const { width, height } = await readImageDimensions(file);
        next.push({
          id: crypto.randomUUID(),
          file,
          original: {
            size: file.size,
            width,
            height,
            type: fileKindLabel(file.type),
          },
          status: 'idle',
          selected: true,
        });
      } catch {
        setGlobalError((prev) =>
          prev
            ? `${prev} Some files could not be read.`
            : 'Some files could not be read as images.',
        );
      }
    }
    if (next.length > 0) {
      setItems((prev) => [...prev, ...next]);
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files?.length) {
      void addFilesFromList(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const openPicker = () => fileInputRef.current?.click();

  const clearAll = () => {
    setItems((prev) => {
      prev.forEach(revokeProcessed);
      return [];
    });
    setGlobalError(null);
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const found = prev.find((i) => i.id === id);
      if (found) revokeProcessed(found);
      return prev.filter((i) => i.id !== id);
    });
  };

  const deleteSelected = () => {
    setItems((prev) => {
      const keep = prev.filter((i) => {
        if (i.selected) {
          revokeProcessed(i);
          return false;
        }
        return true;
      });
      return keep;
    });
  };

  const toggleSelect = (id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, selected: !i.selected } : i)),
    );
  };

  const toggleSelectAll = (checked: boolean) => {
    setItems((prev) => prev.map((i) => ({ ...i, selected: checked })));
  };

  const hasItems = items.length > 0;
  const allSelected = hasItems && items.every((i) => i.selected);
  const someSelected = items.some((i) => i.selected);
  const selectedCount = items.filter((i) => i.selected).length;

  const hasAnyConvertedStatus = items.some((i) => i.status === 'converted');

  const convertedForReview = items.filter(
    (i) => i.status === 'converted' && i.processed,
  );

  const handleConvert = async () => {
    if (items.length === 0 || convertBusyRef.current) return;
    convertBusyRef.current = true;
    setIsConverting(true);
    setGlobalError(null);

    const snapshot = [...items];
    try {
      for (const item of snapshot) {
        if (item.processed?.url) {
          URL.revokeObjectURL(item.processed.url);
        }

        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'converting' as const,
                  errorMessage: undefined,
                  processed: undefined,
                  published: undefined,
                }
              : i,
          ),
        );

        const formData = new FormData();
        formData.append('file', item.file);

        try {
          const res = await fetch('/api/upload?mode=convert', {
            method: 'POST',
            body: formData,
          });
          const data: unknown = await res.json();

          if (!res.ok) {
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id
                  ? {
                      ...i,
                      status: 'error' as const,
                      errorMessage: readJsonError(data),
                    }
                  : i,
              ),
            );
            continue;
          }

          if (!isConvertSuccess(data)) {
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id
                  ? {
                      ...i,
                      status: 'error' as const,
                      errorMessage: 'Invalid convert response',
                    }
                  : i,
              ),
            );
            continue;
          }

          const blob = base64ToBlob(data.base64, data.mimeType);
          const url = URL.createObjectURL(blob);

          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    status: 'converted' as const,
                    processed: {
                      blob,
                      url,
                      size: data.processedSize,
                      width: data.width,
                      height: data.height,
                    },
                  }
                : i,
            ),
          );
        } catch {
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    status: 'error' as const,
                    errorMessage: 'Network error',
                  }
                : i,
            ),
          );
        }
      }
    } finally {
      convertBusyRef.current = false;
      setIsConverting(false);
    }
  };

  const handlePublish = async () => {
    if (publishBusyRef.current) return;

    const targets = items.filter(
      (i) => i.status === 'converted' && i.processed && !i.published,
    );
    if (targets.length === 0) return;

    publishBusyRef.current = true;
    setIsPublishing(true);
    setGlobalError(null);

    try {
      for (const item of targets) {
        setPublishingIds((s) => new Set(s).add(item.id));

        const formData = new FormData();
        formData.append('file', item.file);

        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });
          const data: unknown = await res.json();

          if (!res.ok) {
            setGlobalError(readJsonError(data));
            continue;
          }

          if (!isPublishSuccess(data)) {
            setGlobalError('Invalid response from server');
            continue;
          }

          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    published: { assetId: data.assetId, url: data.url },
                  }
                : i,
            ),
          );
        } catch {
          setGlobalError('Upload failed');
        } finally {
          setPublishingIds((s) => {
            const n = new Set(s);
            n.delete(item.id);
            return n;
          });
        }
      }
    } finally {
      publishBusyRef.current = false;
      setIsPublishing(false);
      setPublishingIds(new Set());
    }
  };

  return (
    <main className="mx-auto max-w-4xl p-6 sm:p-10 flex flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Upload images
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleConvert}
            disabled={!hasItems || isConverting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isConverting && <Spinner className="h-4 w-4 text-white" />}
            {isConverting ? 'Converting...' : 'Convert'}
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={!hasAnyConvertedStatus || isPublishing}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 shadow-sm transition hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPublishing && <Spinner />}
            Upload to database
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={!hasItems}
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={deleteSelected}
            disabled={!someSelected}
            className="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete selected
            {selectedCount > 0 ? ` (${selectedCount})` : ''}
          </button>
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const list = e.target.files;
          if (list?.length) void addFilesFromList(list);
          e.target.value = '';
        }}
      />

      <button
        type="button"
        onClick={openPicker}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="group flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 bg-white px-6 py-14 text-center shadow-sm transition hover:border-neutral-400 hover:bg-neutral-50/80 hover:shadow-md"
      >
        <span className="text-base font-medium text-neutral-800">
          Drag &amp; drop images here
        </span>
        <span className="text-sm text-neutral-500">or click to upload</span>
      </button>

      {globalError && (
        <p className="text-sm text-red-600" role="alert">
          {globalError}
        </p>
      )}

      {hasItems && (
        <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="hidden sm:grid sm:grid-cols-[auto_1fr_auto_auto_auto_auto] sm:items-center sm:gap-3 sm:border-b sm:border-neutral-100 sm:pb-2 sm:text-xs sm:font-semibold sm:uppercase sm:tracking-wide sm:text-neutral-500">
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected && !allSelected;
                }}
                onChange={(e) => toggleSelectAll(e.target.checked)}
                aria-label="Select all"
                className="h-4 w-4 rounded border-neutral-300"
              />
            </div>
            <span>Name</span>
            <span className="text-right">Size</span>
            <span className="text-right">Dimensions</span>
            <span className="text-right">Type</span>
            <span className="text-center">Remove</span>
          </div>

          <ul className="flex flex-col divide-y divide-neutral-100">
            {items.map((item) => (
              <li
                key={item.id}
                className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-[auto_1fr_auto_auto_auto_auto] sm:items-center sm:gap-3"
              >
                <div className="flex items-center gap-3 sm:contents">
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => toggleSelect(item.id)}
                      aria-label={`Select ${item.file.name}`}
                      className="h-4 w-4 rounded border-neutral-300"
                    />
                  </div>
                  <div className="min-w-0 sm:pr-2">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {item.file.name}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500 sm:hidden">
                      <span>{formatKb(item.original.size)}</span>
                      <span>
                        {item.original.width}×{item.original.height}
                      </span>
                      <span>{item.original.type}</span>
                    </div>
                  </div>
                  <span className="hidden text-right text-sm text-neutral-700 sm:block">
                    {formatKb(item.original.size)}
                  </span>
                  <span className="hidden text-right text-sm tabular-nums text-neutral-700 sm:block">
                    {item.original.width}×{item.original.height}
                  </span>
                  <span className="hidden text-right text-sm text-neutral-700 sm:block">
                    {item.original.type}
                  </span>
                  <div className="flex items-center justify-end gap-2 sm:justify-center">
                    {item.status === 'converting' && <Spinner />}
                    {publishingIds.has(item.id) && <Spinner />}
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="rounded-md border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {item.status === 'error' && item.errorMessage && (
                  <p className="col-span-full text-xs text-red-600 sm:col-span-6">
                    {item.errorMessage}
                  </p>
                )}
                {item.published && (
                  <p className="col-span-full text-xs text-emerald-700 sm:col-span-6">
                    Published:{' '}
                    <span className="font-mono break-all">{item.published.assetId}</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {convertedForReview.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Converted images
          </h2>
          <ul className="flex flex-col gap-4">
            {convertedForReview.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2 rounded-lg bg-neutral-50 p-3">
                    <p className="text-xs font-medium text-neutral-500">Original</p>
                    <div className="relative flex max-h-56 items-center justify-center overflow-hidden rounded-md border border-neutral-200 bg-white">
                      <OriginalPreviewImage file={item.file} label={item.file.name} />
                    </div>
                    <p className="text-xs text-neutral-600">
                      {formatKb(item.original.size)} · {item.original.width}×
                      {item.original.height}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 rounded-lg bg-neutral-50 p-3">
                    <p className="text-xs font-medium text-neutral-500">Processed (CDN)</p>
                    <div className="relative flex max-h-56 items-center justify-center overflow-hidden rounded-md border border-neutral-200 bg-white">
                      {item.processed ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={item.processed.url}
                          alt="Processed image"
                          className="max-h-56 w-full object-contain"
                        />
                      ) : null}
                    </div>
                    <p className="text-xs text-neutral-600">
                      {item.processed
                        ? `${formatKb(item.processed.size)} · ${item.processed.width}×${item.processed.height}`
                        : ''}
                    </p>
                  </div>
                </div>
                {item.published && (
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
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

/** 1×1 transparent GIF — valid `src` so we never use `""` (avoids re-fetching the document). */
const IMG_SRC_PLACEHOLDER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** Object URL for original file; revoked on unmount or file change. */
function OriginalPreviewImage({ file, label }: { file: File; label: string }) {
  const imgRef = useRef<HTMLImageElement>(null);

  useLayoutEffect(() => {
    const url = URL.createObjectURL(file);
    const el = imgRef.current;
    if (el) el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      ref={imgRef}
      src={IMG_SRC_PLACEHOLDER}
      alt={label}
      className="max-h-56 w-full object-contain"
    />
  );
}
