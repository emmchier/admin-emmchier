import type { SpaceId } from './spaces';

export type ContentfulEnv = {
  spaceId: string;
  environmentId: string;
};

/**
 * Resolves Contentful target env per admin space.
 * Maps: art → CONTENTFUL_SPACE_ART_ID, design → CONTENTFUL_SPACE_DESIGN_ID, hub → CONTENTFUL_SPACE_HUB_ID.
 */
export function getContentfulEnv(space: SpaceId): ContentfulEnv {
  const environmentId = process.env.CONTENTFUL_ENVIRONMENT;

  if (!environmentId) {
    throw new Error(
      'Missing Contentful configuration: CONTENTFUL_ENVIRONMENT must be set',
    );
  }

  const spaceIdByKey: Record<SpaceId, string | undefined> = {
    art: process.env.CONTENTFUL_SPACE_ART_ID,
    design: process.env.CONTENTFUL_SPACE_DESIGN_ID,
    hub: process.env.CONTENTFUL_SPACE_HUB_ID,
  };

  const spaceId = spaceIdByKey[space];
  if (!spaceId) {
    throw new Error(
      `Missing Contentful space id for "${space}". Set CONTENTFUL_SPACE_${space.toUpperCase()}_ID`,
    );
  }

  return { spaceId, environmentId };
}

function isInvalidContentTypeId(raw: string | undefined): boolean {
  const t = raw?.trim();
  if (!t) return true;
  if (/^doesnotexist$/i.test(t)) return true;
  return false;
}

/**
 * Content type for the optional “image wrapper” entry (slug + link to Asset) after upload.
 * - **hub**: default `null` — only the Asset is created (resume/social link the Asset directly).
 *   Set `CONTENTFUL_HUB_IMAGE_ASSET_CONTENT_TYPE_ID` if your Hub space uses a wrapper model.
 * - **art / design**: defaults to `imageAsset` unless `CONTENTFUL_IMAGE_ASSET_CONTENT_TYPE_ID` overrides.
 */
export function getImageAssetWrapperContentTypeId(space: SpaceId): string | null {
  if (space === 'hub') {
    const hub = process.env.CONTENTFUL_HUB_IMAGE_ASSET_CONTENT_TYPE_ID;
    if (!isInvalidContentTypeId(hub)) return hub!.trim();
    return null;
  }
  const global = process.env.CONTENTFUL_IMAGE_ASSET_CONTENT_TYPE_ID;
  if (!isInvalidContentTypeId(global)) return global!.trim();
  return 'imageAsset';
}

/** @deprecated Prefer `getImageAssetWrapperContentTypeId('art')` for space-aware behavior. */
export function getImageAssetContentTypeId(): string {
  const global = process.env.CONTENTFUL_IMAGE_ASSET_CONTENT_TYPE_ID;
  if (!isInvalidContentTypeId(global)) return global!.trim();
  return 'imageAsset';
}

export function getEntryLocale(): string {
  return process.env.CONTENTFUL_ENTRY_LOCALE ?? 'en-US';
}
