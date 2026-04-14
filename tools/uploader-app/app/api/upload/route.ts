import { createClient } from 'contentful-management';
import type { AssetProps, PlainClientAPI } from 'contentful-management';
import { NextResponse } from 'next/server';
import path from 'node:path';
import sharp from 'sharp';

export const runtime = 'nodejs';

const MAX_SIZE_BYTES = 15 * 1024 * 1024;
const DEFAULT_MAX_WIDTH_PX = 2400;
const DEFAULT_QUALITY = 85;
const DEFAULT_FORMAT = 'webp' as const;

const ASSET_LOCALE = 'en-US' as const;
const ENTRY_LOCALE = 'en-US' as const;
const CONTENT_TYPE_ID = 'imageAsset' as const;

type OutputFormat = 'webp' | 'jpeg' | 'png';
type PublishMeta = { title: string; alt: string };

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

function readFormText(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

function readFormInt(formData: FormData, key: string): number | null {
  const raw = readFormText(formData, key);
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

function readOutputFormat(formData: FormData): OutputFormat {
  const raw = readFormText(formData, 'format').toLowerCase();
  if (raw === 'jpeg' || raw === 'png' || raw === 'webp') return raw;
  return DEFAULT_FORMAT;
}

function extForFormat(format: OutputFormat): string {
  if (format === 'jpeg') return 'jpg';
  return format;
}

function mimeForFormat(format: OutputFormat): string {
  if (format === 'jpeg') return 'image/jpeg';
  if (format === 'png') return 'image/png';
  return 'image/webp';
}

function toOutputFileName(originalFileName: string, format: OutputFormat): string {
  const base = path.basename(originalFileName) || 'image';
  const stem = base.includes('.') ? base.slice(0, base.lastIndexOf('.')) : base;
  return `${stem}.${extForFormat(format)}`;
}

function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  // Force a *real* ArrayBuffer (Buffer may be backed by SharedArrayBuffer in some runtimes).
  const out = new ArrayBuffer(buf.byteLength);
  new Uint8Array(out).set(buf);
  return out;
}

function toAbsoluteCdnUrl(urlOrPath: string): string {
  if (!urlOrPath) return '';
  if (urlOrPath.startsWith('//')) return `https:${urlOrPath}`;
  return urlOrPath;
}

function getPublishedFileUrl(asset: AssetProps): string {
  const maybe = asset.fields?.file?.[ASSET_LOCALE]?.url ?? '';
  return toAbsoluteCdnUrl(maybe);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

async function ensureUniqueSlug(args: {
  client: PlainClientAPI;
  spaceId: string;
  environmentId: string;
  contentTypeId: string;
  baseSlug: string;
}): Promise<string> {
  const { client, spaceId, environmentId, contentTypeId, baseSlug } = args;
  const base = baseSlug.trim().replace(/(^-|-$)+/g, '') || 'image';

  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const existing = await client.entry.getMany({
      spaceId,
      environmentId,
      query: {
        content_type: contentTypeId,
        limit: 1,
        'fields.slug': candidate,
      },
    });
    if (!existing.items || existing.items.length === 0) return candidate;
  }

  return `${base}-51`;
}

function parsePublishMetadata(formData: FormData): PublishMeta | { error: string } {
  const title = readFormText(formData, 'title');
  const alt = readFormText(formData, 'alt');
  if (!title || !alt) return { error: 'Missing required fields: title and alt' };
  return { title, alt };
}

async function processImage(args: {
  inputBuffer: Buffer;
  maxWidthPx: number;
  format: OutputFormat;
  quality: number;
}): Promise<{ buffer: Buffer; width: number; height: number }> {
  const { inputBuffer, maxWidthPx, format, quality } = args;

  let image = sharp(inputBuffer, { failOn: 'none', limitInputPixels: false }).rotate();
  image = image.resize({ width: maxWidthPx, withoutEnlargement: true });

  if (format === 'webp') image = image.webp({ quality });
  if (format === 'jpeg') image = image.jpeg({ quality, mozjpeg: true });
  if (format === 'png') image = image.png({ quality });

  const { data, info } = await image.toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width ?? 0, height: info.height ?? 0 };
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get('mode') ?? 'upload';

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'File too large (max 15MB)' }, { status: 400 });
    }

    const format = readOutputFormat(formData);
    const quality = Math.min(100, Math.max(1, readFormInt(formData, 'quality') ?? DEFAULT_QUALITY));
    const maxWidthRaw = readFormInt(formData, 'maxWidth');
    const maxWidthPx =
      maxWidthRaw === null
        ? DEFAULT_MAX_WIDTH_PX
        : maxWidthRaw <= 0
          ? DEFAULT_MAX_WIDTH_PX
          : Math.min(6000, maxWidthRaw);

    const inputBuffer = Buffer.from(await file.arrayBuffer());
    const { buffer: processedBuffer, width, height } = await processImage({
      inputBuffer,
      maxWidthPx,
      format,
      quality,
    });

    const processedMime = mimeForFormat(format);

    if (mode === 'convert') {
      return NextResponse.json({
        base64: processedBuffer.toString('base64'),
        mimeType: processedMime,
        originalSize: file.size,
        processedSize: processedBuffer.byteLength,
        width,
        height,
      });
    }

    const meta = parsePublishMetadata(formData);
    if ('error' in meta) return NextResponse.json({ error: meta.error }, { status: 400 });

    const accessToken = requireEnv('CONTENTFUL_MANAGEMENT_TOKEN');
    const spaceId = requireEnv('CONTENTFUL_SPACE_ART_ID');
    const environmentId = process.env.CONTENTFUL_ENVIRONMENT || 'master';

    const client = createClient({ accessToken });

    const arrayBuffer = bufferToArrayBuffer(processedBuffer);
    const upload = await client.upload.create({ spaceId, environmentId }, { file: arrayBuffer });

    const assetTitle = meta.title;
    const originalFileName = file.name;
    const outputFileName = toOutputFileName(originalFileName, format);

    const draftAsset = await client.asset.create(
      { spaceId, environmentId },
      {
        fields: {
          title: { [ASSET_LOCALE]: assetTitle },
          file: {
            [ASSET_LOCALE]: {
              fileName: outputFileName,
              contentType: processedMime,
              uploadFrom: {
                sys: { type: 'Link', linkType: 'Upload', id: upload.sys.id },
              },
            },
          },
        },
      },
    );

    const processedAsset = await client.asset.processForAllLocales(
      { spaceId, environmentId },
      draftAsset,
    );

    const publishedAsset = await client.asset.publish(
      { spaceId, environmentId, assetId: processedAsset.sys.id },
      processedAsset,
    );

    const assetId = publishedAsset.sys.id;
    const cdnUrl = getPublishedFileUrl(publishedAsset);

    const baseSlug = slugify(meta.title || originalFileName);
    const uniqueSlug = await ensureUniqueSlug({
      client,
      spaceId,
      environmentId,
      contentTypeId: CONTENT_TYPE_ID,
      baseSlug,
    });

    const draftEntry = await client.entry.create(
      { spaceId, environmentId, contentTypeId: CONTENT_TYPE_ID },
      {
        fields: {
          title: { [ENTRY_LOCALE]: meta.title },
          alt: { [ENTRY_LOCALE]: meta.alt },
          slug: { [ENTRY_LOCALE]: uniqueSlug },
          image: {
            [ENTRY_LOCALE]: {
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

    return NextResponse.json({
      assetId,
      entryId: publishedEntry.sys.id,
      url: cdnUrl,
      originalSize: file.size,
      processedSize: processedBuffer.byteLength,
      mimeType: processedMime,
      width,
      height,
    });
  } catch (error) {
    console.error('Upload failed:', error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

