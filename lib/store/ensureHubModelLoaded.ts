'use client';

import type { HubModelName } from '@/lib/store/hubStore';
import { useHubStore } from '@/lib/store/hubStore';

const CONTENT_TYPE: Record<HubModelName, string> = {
  contact: 'contact',
  socialNetwork: 'socialNetwork',
  experience: 'experience',
  course: 'course',
  study: 'study',
  language: 'language',
  tech: 'tech',
  resume: 'resume',
};

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
    const ct = CONTENT_TYPE[model];
    const limit = model === 'resume' ? 5 : 1000;
    const res = await fetch(
      `/api/contentful/hub/delivery/entries?contentType=${encodeURIComponent(ct)}&limit=${limit}`,
      {
      method: 'GET',
      cache: 'no-store',
      },
    );
    const data = (await res.json()) as { items?: unknown[]; error?: string };
    if (!res.ok) throw new Error(data?.error || `Failed to load HUB ${model}`);
    useHubStore.getState().setModel(model, (data.items ?? []) as any[]);
  })();

  inflight.set(model, run);
  try {
    await run;
  } finally {
    inflight.delete(model);
  }
}

