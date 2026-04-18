'use client';

import type { HubModelName } from '@/lib/store/hubStore';
import { useHubStore } from '@/lib/store/hubStore';
import { contentfulService } from '@/services/contentfulService';

const inflight = new Map<HubModelName, Promise<void>>();

/**
 * HUB on-demand loader (ART-equivalent):
 * - cache-first (Zustand)
 * - fetch only when missing or forced
 * - dedupe concurrent requests per model
 *
 * Uses Delivery API route for fast published lists.
 */
export async function ensureHubModelLoaded(model: HubModelName, options?: { force?: boolean }): Promise<void> {
  const { force } = options ?? {};
  const store = useHubStore.getState();

  if (!force && store.isLoaded(model)) {
    return;
  }

  const pending = inflight.get(model);
  if (pending) return pending;

  const run = (async () => {
    await contentfulService.ensureHubModelLoaded(model, { force });
  })();

  inflight.set(model, run);
  try {
    await run;
  } finally {
    inflight.delete(model);
  }
}

