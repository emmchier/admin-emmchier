'use client';

import type { HubModelName } from '@/lib/store/hubStore';
import { useHubStore } from '@/lib/store/hubStore';
import { contentfulService } from '@/services/contentfulService';

export async function upsertHubEntryFromManagementApi(model: HubModelName, entryId: string): Promise<void> {
  const item = (await contentfulService.getEntryById({ space: 'hub', entryId })) as any;
  if (!item?.sys?.id) return;
  useHubStore.getState().upsert(model, item);
}

