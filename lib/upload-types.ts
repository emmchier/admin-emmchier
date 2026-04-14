export type ItemContentfulMeta = {
  title: string;
  alt: string;
};

export type UploadItem = {
  id: string;
  file: File;
  original: {
    size: number;
    width: number;
    height: number;
    type: string;
  };
  contentful: ItemContentfulMeta;
  processed?: {
    blob: Blob;
    url: string;
    size: number;
    width: number;
    height: number;
  };
  status: 'idle' | 'converting' | 'converted' | 'error';
  selected: boolean;
  published?: { assetId: string; entryId: string; url: string };
  errorMessage?: string;
};

export type ConvertSuccess = {
  base64: string;
  mimeType: string;
  originalSize: number;
  processedSize: number;
  width: number;
  height: number;
};

export type PublishSuccess = {
  assetId: string;
  entryId: string;
  url: string;
  originalSize: number;
  processedSize: number;
};

export function isConvertSuccess(data: unknown): data is ConvertSuccess {
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

export function isPublishSuccess(data: unknown): data is PublishSuccess {
  if (typeof data !== 'object' || data === null) return false;
  const o = data as Record<string, unknown>;
  return (
    typeof o.assetId === 'string' &&
    typeof o.entryId === 'string' &&
    typeof o.url === 'string' &&
    typeof o.originalSize === 'number' &&
    typeof o.processedSize === 'number'
  );
}
