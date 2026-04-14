'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dropzone } from './Dropzone';
import { ImageModal } from './ImageModal';
import type { SpaceId } from '@/lib/spaces';
import {
  base64ToBlob,
  fileKindLabel,
  formatKb,
  readImageDimensions,
  readJsonError,
} from '@/lib/upload-helpers';
import { isConvertSuccess, isPublishSuccess } from '@/lib/upload-types';
import { Copy, Download, ExternalLink, Trash2 } from 'lucide-react';

type ImageItem = {
  id: string;
  file: File;
  status:
    | 'idle'
    | 'converting'
    | 'converted'
    | 'uploading'
    | 'publishing'
    | 'done'
    | 'error';
  progress: number; // 0 - 100
  selected: boolean;
  originalUrl?: string;
  original: {
    size: number;
    width?: number;
    height?: number;
    type: string;
  };
  processed?: {
    url: string;
    base64DataUrl: string;
    size: number;
    width: number;
    height: number;
    type: string;
  };
  cdnUrl?: string;
  contentful: {
    title: string;
    alt: string;
  };
  errorMessage?: string;
};

type ArtUploaderDashboardProps = {
  space: SpaceId;
};

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/tiff',
]);

type PreviewModalState = { src: string; alt: string } | null;
type ConfirmDeleteState = { open: boolean; count: number };

export function ArtUploaderDashboard({ space }: ArtUploaderDashboardProps) {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [isUploadingToCMS, setIsUploadingToCMS] = useState(false);
  const [publishingIds, setPublishingIds] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<PreviewModalState>(null);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDeleteState>({
    open: false,
    count: 0,
  });
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const convertBusyRef = useRef(false);
  const publishBusyRef = useRef(false);
  const progressIntervalsRef = useRef<Map<string, number>>(new Map());
  const validationTimeoutsRef = useRef<Map<string, number>>(new Map());

  const revokeObjectUrls = useCallback((item: ImageItem) => {
    if (item.originalUrl) URL.revokeObjectURL(item.originalUrl);
    if (item.processed?.url) URL.revokeObjectURL(item.processed.url);
  }, []);

  const updateImage = useCallback((id: string, patch: Partial<ImageItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const simulateProgress = useCallback(
    (id: string) => {
      const prev = progressIntervalsRef.current.get(id);
      if (prev) window.clearInterval(prev);

      let progress = 0;
      const interval = window.setInterval(() => {
        progress += Math.random() * 10;
        updateImage(id, { progress: Math.min(progress, 29) });
        if (progress >= 29) {
          window.clearInterval(interval);
          progressIntervalsRef.current.delete(id);
        }
      }, 200);
      progressIntervalsRef.current.set(id, interval);
    },
    [updateImage],
  );

  const simulateProgressRange = useCallback(
    (id: string, from: number, to: number) => {
      const prev = progressIntervalsRef.current.get(id);
      if (prev) window.clearInterval(prev);

      let progress = from;
      const hardCap = Math.max(from, to - 1);
      const interval = window.setInterval(() => {
        progress += Math.random() * 10;
        updateImage(id, { progress: Math.min(progress, hardCap) });
        if (progress >= hardCap) {
          window.clearInterval(interval);
          progressIntervalsRef.current.delete(id);
        }
      }, 200);
      progressIntervalsRef.current.set(id, interval);
    },
    [updateImage],
  );

  useEffect(() => {
    const intervals = progressIntervalsRef.current;
    const timeouts = validationTimeoutsRef.current;
    return () => {
      for (const interval of intervals.values()) {
        window.clearInterval(interval);
      }
      intervals.clear();
      for (const t of timeouts.values()) {
        window.clearTimeout(t);
      }
      timeouts.clear();
      items.forEach(revokeObjectUrls);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!successToast) return;
    const t = window.setTimeout(() => setSuccessToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [successToast]);

  const addFilesFromList = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setGlobalError(null);
    const next: ImageItem[] = [];

    for (const file of files) {
      const id = crypto.randomUUID();
      const typeOk = ALLOWED_TYPES.has(file.type);
      const sizeOk = file.size <= MAX_BYTES;

      if (!typeOk || !sizeOk) {
        const msg = !typeOk ? 'Unsupported format' : 'File too large (max 15MB)';
        next.push({
          id,
          file,
          status: 'error',
          progress: 0,
          selected: false,
          original: { size: file.size, type: fileKindLabel(file.type || 'image') },
          contentful: { title: '', alt: '' },
          errorMessage: msg,
        });

        const timeout = window.setTimeout(() => {
          setItems((prev) => prev.filter((i) => i.id !== id));
          validationTimeoutsRef.current.delete(id);
        }, 4500);
        validationTimeoutsRef.current.set(id, timeout);
        continue;
      }

      let width: number | undefined;
      let height: number | undefined;
      try {
        const dim = await readImageDimensions(file);
        width = dim.width;
        height = dim.height;
      } catch {
        // keep undefined
      }

      const originalUrl = URL.createObjectURL(file);
      next.push({
        id,
        file,
        status: 'idle',
        progress: 0,
        selected: true,
        originalUrl,
        original: {
          size: file.size,
          width,
          height,
          type: fileKindLabel(file.type),
        },
        contentful: { title: '', alt: '' },
      });
    }

    if (next.length > 0) {
      setItems((prev) => [...prev, ...next]);
    }
  }, []);

  const clearAll = () => {
    setItems((prev) => {
      prev.forEach(revokeObjectUrls);
      return [];
    });
    setGlobalError(null);
    setConfirmDelete({ open: false, count: 0 });
    setPreview(null);
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const found = prev.find((i) => i.id === id);
      if (found) revokeObjectUrls(found);
      return prev.filter((i) => i.id !== id);
    });
  };

  const hasItems = items.length > 0;
  const doneItems = useMemo(
    () => items.filter((i) => i.status === 'done'),
    [items],
  );

  function isImageValid(img: ImageItem): boolean {
    return (
      img.contentful.title.trim().length > 0 && img.contentful.alt.trim().length > 0
    );
  }

  const allValid = hasItems && items.every(isImageValid);
  const hasAnyIdle = items.some((i) => i.status === 'idle');
  const allConverted = hasItems && items.every((i) => i.status === 'converted');

  const isAnyBusy = items.some(
    (i) => i.status === 'converting' || i.status === 'uploading' || i.status === 'publishing',
  );

  const canConvert = hasItems && hasAnyIdle && allValid && !isConverting && !isAnyBusy;
  const canUpload = hasItems && allValid && allConverted && !isUploadingToCMS && !isAnyBusy;

  const allSelected = hasItems && items.every((i) => i.selected);
  const someSelected = items.some((i) => i.selected);
  const selectedCount = items.filter((i) => i.selected).length;

  const toggleSelect = (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, selected: !i.selected } : i)));
  };

  const toggleSelectAll = (checked: boolean) => {
    setItems((prev) => prev.map((i) => ({ ...i, selected: checked })));
  };

  const askDeleteSelected = () => {
    if (selectedCount === 0) return;
    setConfirmDelete({ open: true, count: selectedCount });
  };

  const deleteSelected = () => {
    setItems((prev) => {
      const keep: ImageItem[] = [];
      for (const i of prev) {
        if (i.selected) revokeObjectUrls(i);
        else keep.push(i);
      }
      return keep;
    });
    setConfirmDelete({ open: false, count: 0 });
  };

  const handleConvert = async () => {
    if (items.length === 0 || convertBusyRef.current) return;
    convertBusyRef.current = true;
    setIsConverting(true);
    setGlobalError(null);

    const snapshot = [...items];
    try {
      for (const item of snapshot) {
        if (item.status !== 'idle') continue;

        if (!ALLOWED_TYPES.has(item.file.type) || item.file.size > MAX_BYTES) continue;

        if (item.processed?.url) URL.revokeObjectURL(item.processed.url);
        updateImage(item.id, {
          status: 'converting',
          progress: 0,
          processed: undefined,
          cdnUrl: undefined,
          errorMessage: undefined,
        });

        simulateProgress(item.id);

        const formData = new FormData();
        formData.append('file', item.file);

        try {
          const res = await fetch('/api/upload?mode=convert', {
            method: 'POST',
            body: formData,
          });
          const data: unknown = await res.json();

          if (!res.ok) {
            updateImage(item.id, {
              status: 'error',
              progress: 0,
              errorMessage: readJsonError(data),
            });
            continue;
          }

          if (!isConvertSuccess(data)) {
            updateImage(item.id, {
              status: 'error',
              progress: 0,
              errorMessage: 'Invalid convert response',
            });
            continue;
          }

          const blob = base64ToBlob(data.base64, data.mimeType);
          const processedUrl = URL.createObjectURL(blob);
          const processedDataUrl = `data:${data.mimeType};base64,${data.base64}`;

          const interval = progressIntervalsRef.current.get(item.id);
          if (interval) {
            window.clearInterval(interval);
            progressIntervalsRef.current.delete(item.id);
          }

          updateImage(item.id, {
            status: 'converted',
            progress: 30,
            processed: {
              url: processedUrl,
              base64DataUrl: processedDataUrl,
              size: data.processedSize,
              width: data.width,
              height: data.height,
              type: fileKindLabel(data.mimeType),
            },
            errorMessage: undefined,
          });
        } catch {
          updateImage(item.id, {
            status: 'error',
            progress: 0,
            errorMessage: 'Network error',
          });
        }
      }
    } finally {
      convertBusyRef.current = false;
      setIsConverting(false);
    }
  };

  const handlePublish = async () => {
    if (isUploadingToCMS || publishBusyRef.current) return;

    const targets = items.filter((i) => i.status === 'converted' && isImageValid(i));
    if (targets.length === 0) return;

    publishBusyRef.current = true;
    setIsUploadingToCMS(true);
    setGlobalError(null);

    console.log('Uploading batch:', targets.length);

    let successCount = 0;
    try {
      for (const item of targets) {
        setPublishingIds((s) => new Set(s).add(item.id));

        updateImage(item.id, {
          status: 'uploading',
          progress: Math.max(item.progress, 30),
          errorMessage: undefined,
        });
        simulateProgressRange(item.id, 30, 90);

        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('title', item.contentful.title.trim());
        formData.append('alt', item.contentful.alt.trim());

        try {
          const res = await fetch(`/api/upload?space=${encodeURIComponent(space)}`, {
            method: 'POST',
            body: formData,
          });
          const data: unknown = await res.json();

          if (!res.ok) {
            const interval = progressIntervalsRef.current.get(item.id);
            if (interval) {
              window.clearInterval(interval);
              progressIntervalsRef.current.delete(item.id);
            }
            updateImage(item.id, { status: 'error', errorMessage: readJsonError(data) });
            setGlobalError(readJsonError(data));
            continue;
          }

          if (!isPublishSuccess(data)) {
            setGlobalError('Invalid response from server');
            const interval = progressIntervalsRef.current.get(item.id);
            if (interval) {
              window.clearInterval(interval);
              progressIntervalsRef.current.delete(item.id);
            }
            updateImage(item.id, { status: 'error', errorMessage: 'Invalid response from server' });
            continue;
          }

          updateImage(item.id, { status: 'publishing', progress: 90 });
          simulateProgressRange(item.id, 90, 100);

          const interval = progressIntervalsRef.current.get(item.id);
          if (interval) {
            window.clearInterval(interval);
            progressIntervalsRef.current.delete(item.id);
          }

          updateImage(item.id, {
            cdnUrl: data.url,
            status: 'done',
            progress: 100,
            errorMessage: undefined,
          });
          successCount += 1;
        } catch {
          setGlobalError('Upload failed');
          const interval = progressIntervalsRef.current.get(item.id);
          if (interval) {
            window.clearInterval(interval);
            progressIntervalsRef.current.delete(item.id);
          }
          updateImage(item.id, { status: 'error', errorMessage: 'Upload failed' });
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
      setIsUploadingToCMS(false);
      setPublishingIds(new Set());
      if (successCount > 0) {
        setSuccessToast(`${successCount} images uploaded successfully`);
      }
    }
  };

  const handleDownload = (img: ImageItem) => {
    const dataUrl = img.processed?.base64DataUrl;
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = img.file.name.replace(/\.\w+$/, '.webp');
    a.click();
  };

  const handleCopyUrl = async (img: ImageItem) => {
    if (!img.cdnUrl) return;
    await navigator.clipboard.writeText(img.cdnUrl);
  };

  const handleOpen = (img: ImageItem) => {
    if (!img.cdnUrl) return;
    window.open(img.cdnUrl, '_blank');
  };

  const handleDownloadAll = () => {
    doneItems.forEach(handleDownload);
  };

  const openPreview = (src: string | undefined, alt: string) => {
    if (!src) return;
    setPreview({ src, alt });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {items.length === 0 ? (
        <div className="flex min-h-[520px] flex-1 items-center justify-center">
          <div className="w-full max-w-3xl">
            <Dropzone onPickFiles={addFilesFromList} fileInputRef={fileInputRef} variant="empty" />
          </div>
        </div>
      ) : (
        <>
          <Dropzone onPickFiles={addFilesFromList} fileInputRef={fileInputRef} variant="compact" />

          <div className="sticky top-0 z-20 rounded-xl border border-neutral-200 bg-white px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-neutral-900">Upload images</span>
                <label className="flex items-center gap-2 text-xs text-neutral-600">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300"
                  />
                  Select all
                </label>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleConvert}
                  disabled={!canConvert}
                  className="cursor-pointer rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isConverting ? 'Converting…' : 'Convert'}
                </button>

                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={!canUpload}
                  className="cursor-pointer rounded-lg border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isUploadingToCMS ? 'Uploading…' : 'Upload'}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadAll}
                  disabled={doneItems.length === 0}
                  className="ml-2 cursor-pointer rounded-lg border border-neutral-200 p-2 text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Download all processed"
                  title="Download all"
                >
                  <Download className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={clearAll}
                  className="cursor-pointer rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
                >
                  Clear
                </button>

                <button
                  type="button"
                  onClick={askDeleteSelected}
                  disabled={selectedCount === 0}
                  className="cursor-pointer rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Delete selected{selectedCount > 0 ? ` (${selectedCount})` : ''}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {globalError ? (
        <p className="text-sm text-red-600" role="alert">
          {globalError}
        </p>
      ) : null}

      {items.length > 0 ? (
      <div className="upload-table-scroll min-h-0 flex-1 pr-1">
        <ul className="flex flex-col divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {items.map((img) => (
            <li key={img.id} className="p-4 transition hover:bg-neutral-50">
              {img.status === 'converting' ? (
                <div className="grid gap-3 md:grid-cols-[auto_1fr] md:items-start">
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      checked={img.selected}
                      onChange={() => toggleSelect(img.id)}
                      className="h-4 w-4 rounded border-neutral-300 cursor-pointer"
                      aria-label={`Select ${img.file.name}`}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium text-neutral-900">{img.file.name}</p>
                      <span className="text-xs text-neutral-500">{Math.round(img.progress)}%</span>
                    </div>
                    <div className="w-full bg-neutral-200 h-2 rounded overflow-hidden">
                      <div
                        className="bg-black h-full transition-all duration-300"
                        style={{ width: `${img.progress}%` }}
                      />
                    </div>
                    {img.errorMessage ? <p className="text-xs text-red-600">{img.errorMessage}</p> : null}
                  </div>
                </div>
              ) : img.status === 'uploading' ? (
                <div className="grid gap-3 md:grid-cols-[auto_1fr] md:items-start">
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      checked={img.selected}
                      onChange={() => toggleSelect(img.id)}
                      className="h-4 w-4 rounded border-neutral-300 cursor-pointer"
                      aria-label={`Select ${img.file.name}`}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium text-neutral-900">{img.file.name}</p>
                      <span className="text-xs text-neutral-500">{Math.round(img.progress)}%</span>
                    </div>
                    <div className="w-full bg-neutral-200 rounded-full h-2">
                      <div
                        className="bg-black h-2 rounded-full transition-all duration-300"
                        style={{ width: `${img.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-neutral-500">Uploading…</p>
                    {img.errorMessage ? <p className="text-xs text-red-600">{img.errorMessage}</p> : null}
                  </div>
                </div>
              ) : img.status === 'converted' ? (
                <div className="flex flex-col gap-3">
                  <div className="grid gap-3 md:grid-cols-[auto_1fr_auto] md:items-start">
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        checked={img.selected}
                        onChange={() => toggleSelect(img.id)}
                        className="h-4 w-4 rounded border-neutral-300 cursor-pointer"
                        aria-label={`Select ${img.file.name}`}
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-base font-medium text-neutral-900">{img.file.name}</p>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <label className="flex flex-col gap-1">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Title</span>
                          <input
                            value={img.contentful.title}
                            onChange={(e) =>
                              updateImage(img.id, {
                                contentful: { ...img.contentful, title: e.target.value },
                              })
                            }
                            className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-900 outline-none focus-visible:border-neutral-400 focus-visible:outline focus-visible:outline-offset-0 focus-visible:outline-neutral-400"
                            placeholder="Title"
                          />
                          {img.contentful.title.trim().length === 0 ? (
                            <span className="text-[11px] text-red-600">Title is required</span>
                          ) : null}
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Alt</span>
                          <input
                            value={img.contentful.alt}
                            onChange={(e) =>
                              updateImage(img.id, {
                                contentful: { ...img.contentful, alt: e.target.value },
                              })
                            }
                            className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-900 outline-none focus-visible:border-neutral-400 focus-visible:outline focus-visible:outline-offset-0 focus-visible:outline-neutral-400"
                            placeholder="Alt text"
                          />
                          {img.contentful.alt.trim().length === 0 ? (
                            <span className="text-[11px] text-red-600">Alt is required</span>
                          ) : null}
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDownload(img)}
                        disabled={!img.processed?.base64DataUrl}
                        className="cursor-pointer rounded-lg border border-neutral-200 p-2 text-neutral-800 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Download processed"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(img.id)}
                        className="cursor-pointer rounded-lg border border-neutral-200 p-2 text-neutral-700 transition hover:bg-white"
                        aria-label={`Remove ${img.file.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      className="cursor-pointer rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-left transition hover:bg-neutral-100 hover:opacity-95 duration-200"
                      onClick={() => openPreview(img.originalUrl, img.contentful.alt || img.file.name)}
                    >
                      <p className="text-xs font-medium text-neutral-500">Original</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.originalUrl}
                        alt={img.contentful.alt || img.file.name}
                        className="mt-2 max-h-64 w-full rounded-lg bg-white object-contain cursor-pointer transition-opacity duration-200 hover:opacity-90"
                      />
                      <p className="mt-2 text-xs text-neutral-500">
                        {formatKb(img.original.size)}
                        {img.original.width && img.original.height
                          ? ` · ${img.original.width}×${img.original.height}`
                          : ''}
                        {img.original.type ? ` · ${img.original.type}` : ''}
                      </p>
                    </button>
                    <button
                      type="button"
                      className="cursor-pointer rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-left transition hover:bg-neutral-100 hover:opacity-95 duration-200"
                      onClick={() => openPreview(img.processed?.url, img.contentful.alt || img.file.name)}
                    >
                      <p className="text-xs font-medium text-neutral-500">Processed</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.processed?.url}
                        alt={img.contentful.alt || img.file.name}
                        className="mt-2 max-h-64 w-full rounded-lg bg-white object-contain cursor-pointer transition-opacity duration-200 hover:opacity-90"
                      />
                      {img.processed ? (
                        <p className="mt-2 text-xs text-neutral-500">
                          {formatKb(img.processed.size)} · {img.processed.width}×{img.processed.height} · {img.processed.type}
                        </p>
                      ) : null}
                    </button>
                  </div>
                </div>
              ) : img.status === 'publishing' ? (
                <div className="grid gap-3 md:grid-cols-[auto_1fr] md:items-start">
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      checked={img.selected}
                      onChange={() => toggleSelect(img.id)}
                      className="h-4 w-4 rounded border-neutral-300 cursor-pointer"
                      aria-label={`Select ${img.file.name}`}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium text-neutral-900">{img.file.name}</p>
                      <span className="text-xs text-neutral-500">{Math.round(img.progress)}%</span>
                    </div>
                    <div className="w-full bg-neutral-200 rounded-full h-2">
                      <div
                        className="bg-black h-2 rounded-full transition-all duration-300"
                        style={{ width: `${img.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-neutral-500">Publishing…</p>
                    {img.errorMessage ? <p className="text-xs text-red-600">{img.errorMessage}</p> : null}
                  </div>
                </div>
              ) : img.status === 'done' ? (
                <div className="flex flex-col gap-3">
                  <div className="grid gap-3 md:grid-cols-[auto_1fr_auto] md:items-start">
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        checked={img.selected}
                        onChange={() => toggleSelect(img.id)}
                        className="h-4 w-4 rounded border-neutral-300 cursor-pointer"
                        aria-label={`Select ${img.file.name}`}
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-base font-medium text-neutral-900">{img.file.name}</p>
                      <p className="mt-1 text-sm font-medium text-emerald-700">✓ Published</p>
                      {img.errorMessage ? <p className="mt-1 text-xs text-red-600">{img.errorMessage}</p> : null}

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <label className="flex flex-col gap-1">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Title</span>
                          <input
                            value={img.contentful.title}
                            onChange={(e) =>
                              updateImage(img.id, {
                                contentful: { ...img.contentful, title: e.target.value },
                              })
                            }
                            className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-900 outline-none focus-visible:border-neutral-400 focus-visible:outline focus-visible:outline-offset-0 focus-visible:outline-neutral-400"
                            placeholder="Title"
                          />
                          {img.contentful.title.trim().length === 0 ? (
                            <span className="text-[11px] text-red-600">Title is required</span>
                          ) : null}
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Alt</span>
                          <input
                            value={img.contentful.alt}
                            onChange={(e) =>
                              updateImage(img.id, {
                                contentful: { ...img.contentful, alt: e.target.value },
                              })
                            }
                            className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-900 outline-none focus-visible:border-neutral-400 focus-visible:outline focus-visible:outline-offset-0 focus-visible:outline-neutral-400"
                            placeholder="Alt text"
                          />
                          {img.contentful.alt.trim().length === 0 ? (
                            <span className="text-[11px] text-red-600">Alt is required</span>
                          ) : null}
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDownload(img)}
                        disabled={!img.processed?.base64DataUrl}
                        className="cursor-pointer rounded-lg border border-neutral-200 p-2 text-neutral-800 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Download processed"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      {img.cdnUrl ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleCopyUrl(img)}
                            className="cursor-pointer rounded-lg border border-neutral-200 p-2 text-neutral-800 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label="Copy CDN URL"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpen(img)}
                            className="cursor-pointer rounded-lg border border-neutral-200 p-2 text-neutral-800 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label="Open CDN URL"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => removeItem(img.id)}
                        className="cursor-pointer rounded-lg border border-neutral-200 p-2 text-neutral-700 transition hover:bg-white"
                        aria-label={`Remove ${img.file.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      {publishingIds.has(img.id) ? <span className="ml-1 text-xs text-neutral-500">Uploading…</span> : null}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      className="cursor-pointer rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-left transition hover:bg-neutral-100 hover:opacity-95 duration-200"
                      onClick={() => openPreview(img.originalUrl, img.contentful.alt || img.file.name)}
                    >
                      <p className="text-xs font-medium text-neutral-500">Original</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.originalUrl}
                        alt={img.contentful.alt || img.file.name}
                        className="mt-2 max-h-64 w-full rounded-lg bg-white object-contain cursor-pointer transition-opacity duration-200 hover:opacity-90"
                      />
                      <p className="mt-2 text-xs text-neutral-500">
                        {formatKb(img.original.size)}
                        {img.original.width && img.original.height
                          ? ` · ${img.original.width}×${img.original.height}`
                          : ''}
                        {img.original.type ? ` · ${img.original.type}` : ''}
                      </p>
                    </button>
                    <button
                      type="button"
                      className="cursor-pointer rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-left transition hover:bg-neutral-100 hover:opacity-95 duration-200"
                      onClick={() => openPreview(img.processed?.url, img.contentful.alt || img.file.name)}
                    >
                      <p className="text-xs font-medium text-neutral-500">Processed</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.processed?.url}
                        alt={img.contentful.alt || img.file.name}
                        className="mt-2 max-h-64 w-full rounded-lg bg-white object-contain cursor-pointer transition-opacity duration-200 hover:opacity-90"
                      />
                      {img.processed ? (
                        <p className="mt-2 text-xs text-neutral-500">
                          {formatKb(img.processed.size)} · {img.processed.width}×{img.processed.height} · {img.processed.type}
                        </p>
                      ) : null}
                    </button>
                  </div>

                  {/* Keep cdnUrl in state (copy/open only). */}
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-[auto_1fr_auto] md:items-start">
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      checked={img.selected}
                      onChange={() => toggleSelect(img.id)}
                      className="h-4 w-4 rounded border-neutral-300 cursor-pointer"
                      aria-label={`Select ${img.file.name}`}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <p className="truncate text-sm font-medium text-neutral-900">{img.file.name}</p>
                      <span className="text-xs text-neutral-500">{formatKb(img.original.size)}</span>
                      <span className="text-xs text-neutral-500">
                        {img.original.width && img.original.height ? `${img.original.width}×${img.original.height}` : '—'}
                      </span>
                      <span className="text-xs text-neutral-500">{img.original.type}</span>
                    </div>

                    {img.status === 'error' && img.errorMessage ? (
                      <p className="mt-1 text-xs text-red-600">{img.errorMessage}</p>
                    ) : null}

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Title</span>
                        <input
                          value={img.contentful.title}
                          onChange={(e) =>
                            updateImage(img.id, {
                              contentful: { ...img.contentful, title: e.target.value },
                            })
                          }
                          className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-900 outline-none focus-visible:border-neutral-400 focus-visible:outline focus-visible:outline-offset-0 focus-visible:outline-neutral-400"
                          placeholder="Title"
                        />
                        {img.contentful.title.trim().length === 0 ? (
                          <span className="text-[11px] text-red-600">Title is required</span>
                        ) : null}
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Alt</span>
                        <input
                          value={img.contentful.alt}
                          onChange={(e) =>
                            updateImage(img.id, {
                              contentful: { ...img.contentful, alt: e.target.value },
                            })
                          }
                          className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-900 outline-none focus-visible:border-neutral-400 focus-visible:outline focus-visible:outline-offset-0 focus-visible:outline-neutral-400"
                          placeholder="Alt text"
                        />
                        {img.contentful.alt.trim().length === 0 ? (
                          <span className="text-[11px] text-red-600">Alt is required</span>
                        ) : null}
                      </label>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeItem(img.id)}
                      className="cursor-pointer rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
      ) : null}

      {preview ? (
        <ImageModal src={preview.src} alt={preview.alt} onClose={() => setPreview(null)} />
      ) : null}

      {confirmDelete.open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete"
          onClick={() => setConfirmDelete({ open: false, count: 0 })}
        >
          <div
            className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-neutral-900">Delete images</p>
            <p className="mt-2 text-sm text-neutral-600">
              Are you sure you want to delete {confirmDelete.count} images?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                        className="cursor-pointer rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
                onClick={() => setConfirmDelete({ open: false, count: 0 })}
              >
                Cancel
              </button>
              <button
                type="button"
                        className="cursor-pointer rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100"
                onClick={deleteSelected}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {successToast ? (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-900">
          {successToast}
        </div>
      ) : null}
    </div>
  );
}
