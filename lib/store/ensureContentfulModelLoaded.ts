'use client';

import { normalizeDeliveryEntry } from '@/lib/contentful/normalizeDeliveryEntry';
import type { ContentfulModelName } from '@/lib/store/contentfulStore';
import {
  useContentfulStore,
  type CategoryEntry,
  type NavigationGroupEntry,
  type ProjectEntry,
  type TechEntry,
} from '@/lib/store/contentfulStore';

const CONTENT_TYPE: Record<ContentfulModelName, string> = {
  project: 'project',
  category: 'category',
  navigationGroup: 'navigationGroup',
  tech: 'tech',
};

const inflight = new Map<ContentfulModelName, Promise<void>>();

function applyItems(model: ContentfulModelName, items: unknown[]) {
  const store = useContentfulStore.getState();
  switch (model) {
    case 'project':
      store.setProjects(items as ProjectEntry[]);
      break;
    case 'category':
      store.setCategories(items as CategoryEntry[]);
      break;
    case 'navigationGroup':
      store.setNavigationGroups(items as NavigationGroupEntry[]);
      break;
    case 'tech':
      store.setTechs(items as TechEntry[]);
      break;
  }
}

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
    const ct = CONTENT_TYPE[model];
    const res = await fetch(
      `/api/contentful/delivery/entries?contentType=${encodeURIComponent(ct)}&limit=1000`,
      { method: 'GET', cache: 'no-store' },
    );
    const data = (await res.json()) as { items?: unknown[]; error?: string };
    if (!res.ok) {
      throw new Error(data?.error || `Failed to load ${model}`);
    }
    const rawItems = (data.items ?? []) as unknown[];
    const items = rawItems.map((it) => normalizeDeliveryEntry(it as any));
    applyItems(model, items);
  })();

  inflight.set(model, run);
  try {
    await run;
  } finally {
    inflight.delete(model);
  }
}
