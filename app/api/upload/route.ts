import type { AssetProps } from 'contentful-management';
import type { PlainClientAPI } from 'contentful-management';
import { NextResponse } from 'next/server';
import path from 'node:path';
import sharp from 'sharp';
import { getContentfulEnv, getEntryLocale, getImageAssetContentTypeId } from '@/lib/contentful-env';
import { isSpaceId } from '@/lib/spaces';
import { artClients } from '@/lib/contentful/clients';

export const runtime = 'nodejs';

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_WIDTH_PX = 2400;
const WEBP_QUALITY = 85;
const ASSET_LOCALE = 'en-US' as const;
const PROCESSED_MIME = 'image/webp' as const;

/** WebP filename: basename stem + `.webp` (avoids `photo.jpg.webp`). */
function toWebpFileName(originalFileName: string): string {
  const base = path.basename(originalFileName) || 'image';
  const { name } = path.parse(base);
  const stem = name || 'image';
  return `${stem}.webp`;
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

function toAbsoluteCdnUrl(url: string): string {
  if (url.startsWith('//')) return `https:${url}`;
  return url;
}

function getPublishedFileUrl(asset: AssetProps): string {
  const fileForLocale = asset.fields.file[ASSET_LOCALE];
  if (
    !fileForLocale ||
    typeof fileForLocale !== 'object' ||
    typeof fileForLocale.url !== 'string' ||
    fileForLocale.url.length === 0
  ) {
    throw new Error('Asset is missing file URL for en-US after publish');
  }
  return toAbsoluteCdnUrl(fileForLocale.url);
}

/** Single sharp pipeline: resize, WebP, return buffer + dimensions. */
async function processImageToWebp(inputBuffer: Buffer): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
}> {
  const { data, info } = await sharp(inputBuffer)
    .resize({ width: MAX_WIDTH_PX, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  if (typeof width !== 'number' || typeof height !== 'number') {
    throw new Error('Processed image missing dimensions');
  }

  return { buffer: data, width, height };
}

function readFormText(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

function parsePublishMetadata(formData: FormData): { title: string; alt: string } | { error: string } {
  const title = readFormText(formData, 'title');
  const alt = readFormText(formData, 'alt');

  if (!title || !alt) {
    return { error: 'Missing required fields: title and alt must be non-empty' };
  }

  return { title, alt };
}

/** URL-safe slug from title or filename; Contentful slug is generated server-side (not from UI). */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function ensureUniqueSlug(args: {
  client: PlainClientAPI;
  spaceId: string;
  environmentId: string;
  contentTypeId: string;
  baseSlug: string;
}): Promise<string> {
  const { client, spaceId, environmentId, contentTypeId, baseSlug } = args;

  const slug = baseSlug.trim().replace(/(^-|-$)+/g, '') || 'image';

  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`;
    const query: Record<string, string | number> = {
      content_type: contentTypeId,
      limit: 1,
      'fields.slug': candidate,
    };

    const existing = await client.entry.getMany({
      spaceId,
      environmentId,
      query,
    });

    if (!existing.items || existing.items.length === 0) return candidate;
  }

  // As a last resort, keep readable suffixing without timestamps.
  return `${slug}-51`;
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get('mode');
    const spaceParam = url.searchParams.get('space') ?? 'art';
    if (!isSpaceId(spaceParam)) {
      return NextResponse.json({ error: 'Invalid space parameter' }, { status: 400 });
    }
    const space = spaceParam;

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 },
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 });
    }

    const inputArrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(inputArrayBuffer);

    let processedBuffer: Buffer;
    let processedWidth: number;
    let processedHeight: number;

    try {
      const processed = await processImageToWebp(inputBuffer);
      processedBuffer = processed.buffer;
      processedWidth = processed.width;
      processedHeight = processed.height;
    } catch (processingError) {
      console.error('Image processing failed:', processingError);
      return NextResponse.json(
        {
          error:
            'Could not process image. The file may be corrupted or not a supported image format.',
        },
        { status: 400 },
      );
    }

    if (mode === 'convert') {
      return NextResponse.json({
        base64: processedBuffer.toString('base64'),
        mimeType: PROCESSED_MIME,
        originalSize: file.size,
        processedSize: processedBuffer.byteLength,
        width: processedWidth,
        height: processedHeight,
      });
    }

    const meta = parsePublishMetadata(formData);
    if ('error' in meta) {
      return NextResponse.json({ error: meta.error }, { status: 400 });
    }

    const { title, alt } = meta;
    let assetId: string;
    let cdnUrl: string;
    let entryId: string;

    try {
      const { spaceId, environmentId } = getContentfulEnv(space);
      const originalFileName = file.name;
      const entryLocale = getEntryLocale();
      const imageAssetTypeId = getImageAssetContentTypeId();

      // Reuse the server CMA singleton to avoid extra client instantiation.
      const client = artClients.managementClient;

      if (processedBuffer.length === 0) {
        throw new Error('Processed image buffer is empty');
      }

      const arrayBuffer = bufferToArrayBuffer(processedBuffer);

      if (arrayBuffer.byteLength === 0) {
        throw new Error('Processed image ArrayBuffer is empty');
      }

      const upload = await client.upload.create(
        { spaceId, environmentId },
        { file: arrayBuffer },
      );

      const asset = await client.asset.create(
        { spaceId, environmentId },
        {
          fields: {
            title: {
              [ASSET_LOCALE]: title,
            },
            file: {
              [ASSET_LOCALE]: {
                contentType: PROCESSED_MIME,
                fileName: toWebpFileName(originalFileName),
                uploadFrom: {
                  sys: {
                    type: 'Link',
                    linkType: 'Upload',
                    id: upload.sys.id,
                  },
                },
              },
            },
          },
        },
      );

      // `processForAllLocales` already polls until processed with the options below.
      // It returns an updated asset that can be published directly (no extra `asset.get` round-trip).
      const processedAsset = await client.asset.processForAllLocales(
        { spaceId, environmentId },
        asset,
        { processingCheckWait: 750, processingCheckRetries: 30 },
      );

      const publishedAsset = await client.asset.publish(
        {
          spaceId,
          environmentId,
          assetId: asset.sys.id,
        },
        processedAsset as any,
      );

      assetId = publishedAsset.sys.id;
      cdnUrl = getPublishedFileUrl(publishedAsset);

      const baseSlug = slugify(title || originalFileName);
      const uniqueSlug = await ensureUniqueSlug({
        client,
        spaceId,
        environmentId,
        contentTypeId: imageAssetTypeId,
        baseSlug,
      });

      const draftEntry = await client.entry.create(
        { spaceId, environmentId, contentTypeId: imageAssetTypeId },
        {
          fields: {
            title: { [entryLocale]: title },
            alt: { [entryLocale]: alt },
            slug: { [entryLocale]: uniqueSlug },
            image: {
              [entryLocale]: {
                sys: { type: 'Link', linkType: 'Asset', id: assetId },
              },
            },
          },
        },
      );

      const publishedEntry = await client.entry.publish(
        { spaceId, environmentId, entryId: draftEntry.sys.id },
        draftEntry,
      );

      entryId = publishedEntry.sys.id;
    } catch (contentfulError) {
      console.error('Contentful upload failed:', contentfulError);
      if (
        contentfulError instanceof Error &&
        (contentfulError.message.startsWith('Missing Contentful') ||
          contentfulError.message.startsWith('Missing environment'))
      ) {
        return NextResponse.json(
          { error: contentfulError.message },
          { status: 500 },
        );
      }
      return NextResponse.json(
        { error: 'Failed to upload asset or publish entry in Contentful' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      assetId,
      entryId,
      url: cdnUrl,
      originalSize: file.size,
      processedSize: processedBuffer.byteLength,
    });
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
