import 'server-only';

import { hubClients } from '@/lib/contentful/clients';
import { normalizeDeliveryEntry } from '@/lib/contentful/normalizeDeliveryEntry';
import type { HubCvDeliveryResult } from '@/lib/contentful/hub/types';

/** Contentful CDA `include` depth (0–10). */
export type HubDeliveryIncludeDepth = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type HubDeliveryFetchArgs = {
  contentType: string;
  limit?: number;
};

/**
 * HUB Delivery (CDA): list published entries for a content type.
 * Uses `CONTENTFUL_HUB_DELIVERY_TOKEN` via `hubClients`.
 * Public HTTP routes should still validate against {@link HUB_DELIVERY_CONTENT_TYPE_SET}.
 */
export async function hubDeliveryGetEntries(args: HubDeliveryFetchArgs) {
  const { contentType, limit = 1000 } = args;

  const res = await hubClients.deliveryClient.getEntries({
    content_type: contentType,
    limit,
    order: ['-sys.updatedAt'],
  });

  return { items: res.items, total: res.total };
}

/**
 * Same as {@link hubDeliveryGetEntries} with normalized `sys.publishedAt` (ART-aligned).
 */
export async function hubDeliveryGetEntriesNormalized(args: HubDeliveryFetchArgs) {
  const { items, total } = await hubDeliveryGetEntries(args);
  return {
    items: items.map((item) => normalizeDeliveryEntry(item as any)),
    total,
  };
}

/** @deprecated Prefer `hubDeliveryGetEntries` — name kept for docs / older imports */
export const hubFetchEntries = hubDeliveryGetEntries;

/**
 * Single Delivery request: published `resume` entries plus linked entries/assets up to `include` depth.
 * Shared by {@link getHubCv} and {@link getHubCV}.
 */
export async function fetchHubResumeDeliveryCollection(args?: {
  include?: HubDeliveryIncludeDepth;
  limit?: number;
}) {
  const include: HubDeliveryIncludeDepth = args?.include ?? 2;
  const limit = args?.limit ?? 1;

  return hubClients.deliveryClient.getEntries({
    content_type: 'resume',
    include,
    limit,
    order: ['-sys.updatedAt'],
  });
}

/**
 * Fetches the published HUB resume graph (root `resume` entry + includes).
 * Intended for emmchier.com / shared profile consumption.
 */
export async function getHubCv(args?: {
  include?: HubDeliveryIncludeDepth;
  limit?: number;
}): Promise<HubCvDeliveryResult> {
  const res = await fetchHubResumeDeliveryCollection(args);

  return {
    items: res.items.map((item) => normalizeDeliveryEntry(item as any)),
    total: res.total,
    includes: res.includes,
  };
}
