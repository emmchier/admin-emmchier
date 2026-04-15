'use server';

import { revalidatePath } from 'next/cache';
import { artClients, getEntryLocale } from '@/lib/contentful/clients';
import type { JsonValue } from '@/lib/contentful/entryManagement';
import {
  managementCreateEntry,
  managementDeleteEntry,
  managementPublishEntry,
  managementUnpublishEntry,
  managementUpdateEntry,
} from '@/lib/contentful/entryManagement';

type CreateEntryArgs = {
  contentTypeId: string;
  fields: Record<string, JsonValue>;
};

type UpdateEntryArgs = {
  entryId: string;
  fields: Record<string, JsonValue>;
};

export async function createEntryAction(args: CreateEntryArgs) {
  const entryLocale = getEntryLocale();
  const created = await managementCreateEntry(artClients, entryLocale, args);
  revalidatePath('/dashboard/art');
  return { id: created.sys.id };
}

export async function updateEntryAction(args: UpdateEntryArgs) {
  const entryLocale = getEntryLocale();
  await managementUpdateEntry(artClients, entryLocale, args);
  revalidatePath('/dashboard/art');
  revalidatePath(`/dashboard/art/${args.entryId}`);
  return { ok: true };
}

export async function deleteEntryAction(entryId: string) {
  await managementDeleteEntry(artClients, entryId);
  revalidatePath('/dashboard/art');
  return { ok: true };
}

export async function publishEntryAction(entryId: string) {
  await managementPublishEntry(artClients, entryId);
  revalidatePath('/dashboard/art');
  revalidatePath(`/dashboard/art/${entryId}`);
  return { ok: true };
}

export async function unpublishEntryAction(entryId: string) {
  await managementUnpublishEntry(artClients, entryId);
  revalidatePath('/dashboard/art');
  revalidatePath(`/dashboard/art/${entryId}`);
  return { ok: true };
}
