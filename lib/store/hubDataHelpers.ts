'use client';

import type { HubModelName } from '@/lib/store/hubStore';
import { useHubStore } from '@/lib/store/hubStore';
import { ensureHubModelLoaded } from '@/lib/store/ensureHubModelLoaded';

export async function getFromStoreOrFetch<T>(model: HubModelName, selector: (s: ReturnType<typeof useHubStore.getState>) => T): Promise<T> {
  const store = useHubStore.getState();
  const cached = selector(store as any);
  // If model is loaded, always trust store (even if empty).
  if (store.isLoaded(model)) return cached;
  await ensureHubModelLoaded(model);
  return selector(useHubStore.getState() as any);
}

export function setHubData(model: HubModelName, data: any[]) {
  useHubStore.getState().setModel(model, data);
}

export function invalidateHubKey(model: HubModelName) {
  useHubStore.getState().invalidate(model);
}

