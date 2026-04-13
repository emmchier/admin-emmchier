import { createClient } from 'contentful-management';
import type { AssetProps } from 'contentful-management';
import { NextResponse } from 'next/server';
import path from 'node:path';
import sharp from 'sharp';

export const runtime = 'nodejs';

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_WIDTH_PX = 2400;
const WEBP_QUALITY = 85;
const ASSET_LOCALE = 'en-US' as const;
const PROCESSED_MIME = 'image/webp' as const;

type ContentfulEnv = {
  spaceId: string;
  environmentId: string;
};

function getContentfulEnv(): ContentfulEnv {
  const accessToken = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
  const spaceId = process.env.CONTENTFUL_SPACE_ART_ID;
  const environmentId = process.env.CONTENTFUL_ENVIRONMENT;

  if (!accessToken || !spaceId || !environmentId) {
    throw new Error(
      'Missing Contentful configuration: CONTENTFUL_MANAGEMENT_TOKEN, CONTENTFUL_SPACE_ART_ID, and CONTENTFUL_ENVIRONMENT must be set',
    );
  }

  return { spaceId, environmentId };
}

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

export async function POST(req: Request) {
  try {
    const mode = new URL(req.url).searchParams.get('mode');
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

    let assetId: string;
    let cdnUrl: string;

    try {
      const { spaceId, environmentId } = getContentfulEnv();
      const originalFileName = file.name;

      const client = createClient({
        accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN!,
      });

      if (processedBuffer.length === 0) {
        throw new Error('Processed image buffer is empty');
      }

      const arrayBuffer = bufferToArrayBuffer(processedBuffer);

      if (arrayBuffer.byteLength === 0) {
        throw new Error('Processed image ArrayBuffer is empty');
      }

      console.log('Processed buffer size:', processedBuffer.length);
      console.log('ArrayBuffer byteLength:', arrayBuffer.byteLength);

      const upload = await client.upload.create(
        { spaceId, environmentId },
        { file: arrayBuffer },
      );

      const asset = await client.asset.create(
        { spaceId, environmentId },
        {
          fields: {
            title: {
              [ASSET_LOCALE]: originalFileName,
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

      await client.asset.processForAllLocales(
        { spaceId, environmentId },
        asset,
        { processingCheckWait: 750, processingCheckRetries: 30 },
      );

      const processedAsset = await client.asset.get({
        spaceId,
        environmentId,
        assetId: asset.sys.id,
      });

      const publishedAsset = await client.asset.publish(
        {
          spaceId,
          environmentId,
          assetId: asset.sys.id,
        },
        processedAsset,
      );

      assetId = publishedAsset.sys.id;
      cdnUrl = getPublishedFileUrl(publishedAsset);
    } catch (contentfulError) {
      console.error('Contentful upload failed:', contentfulError);
      if (
        contentfulError instanceof Error &&
        contentfulError.message.startsWith('Missing Contentful')
      ) {
        return NextResponse.json(
          { error: contentfulError.message },
          { status: 500 },
        );
      }
      return NextResponse.json(
        { error: 'Failed to upload or publish asset to Contentful' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      assetId,
      url: cdnUrl,
      originalSize: file.size,
      processedSize: processedBuffer.byteLength,
    });
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
