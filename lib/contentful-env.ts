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

export function getImageAssetContentTypeId(): string {
  return process.env.CONTENTFUL_IMAGE_ASSET_CONTENT_TYPE_ID ?? 'imageAsset';
}

export function getEntryLocale(): string {
  return process.env.CONTENTFUL_ENTRY_LOCALE ?? 'en-US';
}
