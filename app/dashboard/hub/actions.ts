'use server';

import { revalidatePath } from 'next/cache';
import { hubClients, getEntryLocale } from '@/lib/contentful/clients';
import type { JsonValue } from '@/lib/contentful/entryManagement';
import {
  managementCreateEntry,
  managementDeleteEntry,
  managementPublishEntry,
  managementUnpublishEntry,
  managementUpdateEntry,
} from '@/lib/contentful/entryManagement';
import { getHubCV } from '@/lib/contentful/hub/getHubCV';
import type { HubCVPayload } from '@/lib/contentful/hub/hubCvTypes';

type CreateEntryArgs = {
  contentTypeId: string;
  fields: Record<string, JsonValue>;
};

type UpdateEntryArgs = {
  entryId: string;
  fields: Record<string, JsonValue>;
};

export async function hubLoadCvAction(): Promise<HubCVPayload> {
  return getHubCV();
}

export async function hubCreateEntryAction(args: CreateEntryArgs) {
  const entryLocale = getEntryLocale();
  const created = await managementCreateEntry(hubClients, entryLocale, args);
  revalidatePath('/');
  return { id: created.sys.id };
}

export async function hubUpdateEntryAction(args: UpdateEntryArgs) {
  const entryLocale = getEntryLocale();
  await managementUpdateEntry(hubClients, entryLocale, args);
  revalidatePath('/');
  return { ok: true };
}

export async function hubDeleteEntryAction(entryId: string) {
  await managementDeleteEntry(hubClients, entryId);
  revalidatePath('/');
  return { ok: true };
}

export async function hubPublishEntryAction(entryId: string) {
  await managementPublishEntry(hubClients, entryId);
  revalidatePath('/');
  return { ok: true };
}

export async function hubUnpublishEntryAction(entryId: string) {
  await managementUnpublishEntry(hubClients, entryId);
  revalidatePath('/');
  return { ok: true };
}
