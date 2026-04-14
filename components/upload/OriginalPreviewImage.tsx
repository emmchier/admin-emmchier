'use client';

import { useLayoutEffect, useRef } from 'react';

/** 1×1 transparent GIF — valid `src` so we never use `""` (avoids re-fetching the document). */
const IMG_SRC_PLACEHOLDER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export function OriginalPreviewImage({ file, label }: { file: File; label: string }) {
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
      className="max-h-48 w-full cursor-zoom-in object-contain"
    />
  );
}
