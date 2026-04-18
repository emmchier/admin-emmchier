'use client';

import type { ContentfulModelName } from '@/lib/store/contentfulStore';
import { useContentfulStore } from '@/lib/store/contentfulStore';
import { contentfulService } from '@/services/contentfulService';

/** Single-entry CMA fetch to merge into the cache (e.g. after create). */
export async function upsertEntryFromManagementApi(
  model: ContentfulModelName,
  entryId: string,
): Promise<void> {
  const item = await contentfulService.getEntryById({ space: 'art', entryId });
  if (!item || typeof item !== 'object' || !('sys' in item) || typeof (item as any).sys?.id !== 'string') {
    return;
  }

  const store = useContentfulStore.getState();
  switch (model) {
    case 'project':
      store.upsertProject(item as any);
      break;
    case 'category':
      store.upsertCategory(item as any);
      break;
    case 'navigationGroup':
      store.upsertNavigationGroup(item as any);
      break;
    case 'tech':
      store.upsertTech(item as any);
      break;
  }
}
