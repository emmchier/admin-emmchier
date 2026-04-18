import 'server-only';

import { createClient as createDeliveryClient } from 'contentful';
import { createClient as createManagementClient } from 'contentful-management';
import type { ContentfulClientApi } from 'contentful';
import type { PlainClientAPI } from 'contentful-management';
import type { SpaceId } from '@/lib/spaces';

/** Maps 1:1 to `SpaceId` for Contentful client wiring. */
export type ContentfulSpaceKey = SpaceId;

export type ContentfulClients = {
  spaceId: string;
  environmentId: string;
  deliveryClient: ContentfulClientApi<undefined>;
  managementClient: PlainClientAPI;
};

function readEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function requireEnv(name: string): string {
  const v = readEnv(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function requireSpaceConfig(space: ContentfulSpaceKey) {
  if (space === 'art') {
    return {
      spaceId: requireEnv('CONTENTFUL_SPACE_ART_ID'),
      deliveryToken: requireEnv('CONTENTFUL_ART_DELIVERY_TOKEN'),
      managementToken: requireEnv('CONTENTFUL_ART_MANAGEMENT_TOKEN'),
    };
  }
  if (space === 'hub') {
    return {
      spaceId: requireEnv('CONTENTFUL_SPACE_HUB_ID'),
      deliveryToken: requireEnv('CONTENTFUL_HUB_DELIVERY_TOKEN'),
      managementToken: requireEnv('CONTENTFUL_HUB_MANAGEMENT_TOKEN'),
    };
  }
  return {
    spaceId: requireEnv('CONTENTFUL_SPACE_DESIGN_ID'),
    deliveryToken: requireEnv('CONTENTFUL_DESIGN_DELIVERY_TOKEN'),
    managementToken: requireEnv('CONTENTFUL_DESIGN_MANAGEMENT_TOKEN'),
  };
}

/**
 * Factory for per-space clients (CDA + CMA).
 * Keeps a per-space singleton cache to avoid repeated instantiation.
 */
const clientCache = new Map<string, ContentfulClients>();

export function createContentfulClients(args: {
  spaceId: string;
  deliveryToken: string;
  managementToken: string;
  environmentId: string;
}): ContentfulClients {
  const cacheKey = `${args.spaceId}:${args.environmentId}:${args.deliveryToken.slice(0, 6)}:${args.managementToken.slice(0, 6)}`;
  const cached = clientCache.get(cacheKey);
  if (cached) return cached;

  const deliveryClient = createDeliveryClient({
    space: args.spaceId,
    environment: args.environmentId,
    accessToken: args.deliveryToken,
  });

  const managementClient = createManagementClient({
    accessToken: args.managementToken,
  });

  const created: ContentfulClients = {
    spaceId: args.spaceId,
    environmentId: args.environmentId,
    deliveryClient,
    managementClient,
  };
  clientCache.set(cacheKey, created);
  return created;
}

export function getClientsFor(space: ContentfulSpaceKey): ContentfulClients {
  const environmentId = readEnv('CONTENTFUL_ENVIRONMENT') ?? 'master';
  const cfg = requireSpaceConfig(space);
  return createContentfulClients({
    spaceId: cfg.spaceId,
    environmentId,
    deliveryToken: cfg.deliveryToken,
    managementToken: cfg.managementToken,
  });
}

export const artClients = getClientsFor('art');
export const hubClients = getClientsFor('hub');

let designClientsSingleton: ContentfulClients | null = null;

/** Lazy init so apps without Design env still boot (routes hit Design only when used). */
export function getDesignClients(): ContentfulClients {
  if (!designClientsSingleton) {
    designClientsSingleton = getClientsFor('design');
  }
  return designClientsSingleton;
}

export function getEntryLocale(): string {
  return readEnv('CONTENTFUL_ENTRY_LOCALE') ?? 'en-US';
}

