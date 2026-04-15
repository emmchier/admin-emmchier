'use client';

type ImageModalProps = {
  src: string;
  alt: string;
  onClose: () => void;
};

export function ImageModal({ src, alt, onClose }: ImageModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-[min(96vw,1200px)] cursor-default rounded-xl border-2 border-neutral-200 bg-white p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 z-10 rounded-lg border border-neutral-600 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-800"
        >
          Close
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="max-h-[85vh] w-full rounded-lg object-contain" />
      </div>
    </div>
  );
}
