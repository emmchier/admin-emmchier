'use client';

import type { HubModelName } from '@/lib/store/hubStore';
import { useHubStore } from '@/lib/store/hubStore';

export async function upsertHubEntryFromManagementApi(model: HubModelName, entryId: string): Promise<void> {
  const res = await fetch(`/api/contentful/hub/entries/${encodeURIComponent(entryId)}`, { method: 'GET', cache: 'no-store' });
  const data = (await res.json()) as { item?: unknown; error?: string };
  if (!res.ok) throw new Error(data?.error || 'Failed to load entry');
  const item = data.item as any;
  if (!item?.sys?.id) return;
  useHubStore.getState().upsert(model, item);
}

