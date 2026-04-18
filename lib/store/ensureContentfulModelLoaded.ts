'use client';

import type { ContentfulModelName } from '@/lib/store/contentfulStore';
import { useContentfulStore } from '@/lib/store/contentfulStore';
import { contentfulService } from '@/services/contentfulService';

const inflight = new Map<ContentfulModelName, Promise<void>>();

/**
 * On-demand load: uses Delivery API once per model, then Zustand only.
 * Dedupes concurrent requests for the same model.
 */
export async function ensureContentfulModelLoaded(
  model: ContentfulModelName,
  options?: { force?: boolean },
): Promise<void> {
  const { force } = options ?? {};
  const store = useContentfulStore.getState();

  if (!force && store.isModelLoaded(model)) {
    return;
  }

  const pending = inflight.get(model);
  if (pending) {
    return pending;
  }

  const run = (async () => {
    await contentfulService.ensureArtModelLoaded(model, { force });
  })();

  inflight.set(model, run);
  try {
    await run;
  } finally {
    inflight.delete(model);
  }
}
