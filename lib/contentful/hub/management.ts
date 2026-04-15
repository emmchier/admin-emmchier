import 'server-only';

import { hubClients, getEntryLocale } from '@/lib/contentful/clients';
import type { JsonValue } from '@/lib/contentful/entryManagement';
import {
  managementCreateEntry,
  managementDeleteEntry,
  managementPublishEntry,
  managementUnpublishEntry,
  managementUpdateEntry,
} from '@/lib/contentful/entryManagement';

/**
 * HUB Management (CMA): create entry with locale wrapping + field allowlist.
 * Uses `CONTENTFUL_HUB_MANAGEMENT_TOKEN` via `hubClients`.
 */
export async function hubCreateEntry(args: { contentTypeId: string; fields: Record<string, JsonValue> }) {
  return managementCreateEntry(hubClients, getEntryLocale(), args);
}

export async function hubUpdateEntry(args: { entryId: string; fields: Record<string, JsonValue> }) {
  return managementUpdateEntry(hubClients, getEntryLocale(), args);
}

export async function hubDeleteEntry(entryId: string) {
  await managementDeleteEntry(hubClients, entryId);
  return { ok: true as const };
}

export async function hubPublishEntry(entryId: string) {
  const published = await managementPublishEntry(hubClients, entryId);
  return published;
}

export async function hubUnpublishEntry(entryId: string) {
  const unpublished = await managementUnpublishEntry(hubClients, entryId);
  return unpublished;
}
