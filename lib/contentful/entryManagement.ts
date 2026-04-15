import 'server-only';

import type { PlainClientAPI } from 'contentful-management';
import type { ContentfulClients } from '@/lib/contentful/clients';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [k: string]: JsonValue };

export async function allowedFieldIds(
  client: PlainClientAPI,
  spaceId: string,
  environmentId: string,
  contentTypeId: string,
): Promise<Set<string>> {
  const ct = await client.contentType.get({ spaceId, environmentId, contentTypeId });
  return new Set(
    (ct.fields ?? [])
      .map((f: { id?: string }) => f.id)
      .filter((id): id is string => Boolean(id)),
  );
}

export function filterToContentTypeFields(
  fields: Record<string, JsonValue>,
  allowed: Set<string>,
): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (allowed.has(k)) out[k] = v;
  }
  return out;
}

function localizeFieldsMap(fields: Record<string, JsonValue>, entryLocale: string) {
  const localizedFields: Record<string, Record<string, unknown>> = {};
  for (const [k, v] of Object.entries(fields)) {
    localizedFields[k] = { [entryLocale]: v };
  }
  return localizedFields;
}

export async function managementCreateEntry(
  clients: ContentfulClients,
  entryLocale: string,
  args: { contentTypeId: string; fields: Record<string, JsonValue> },
) {
  const { contentTypeId, fields } = args;
  const { managementClient: client, spaceId, environmentId } = clients;

  const allowed = await allowedFieldIds(client, spaceId, environmentId, contentTypeId);
  const safeFields = filterToContentTypeFields(fields, allowed);
  const localizedFields = localizeFieldsMap(safeFields, entryLocale);

  return client.entry.create({ spaceId, environmentId, contentTypeId }, { fields: localizedFields });
}

export async function managementUpdateEntry(
  clients: ContentfulClients,
  entryLocale: string,
  args: { entryId: string; fields: Record<string, JsonValue> },
) {
  const { entryId, fields } = args;
  const { managementClient: client, spaceId, environmentId } = clients;

  const existing = await client.entry.get({ spaceId, environmentId, entryId });
  const contentTypeId = existing.sys.contentType.sys.id;
  const allowed = await allowedFieldIds(client, spaceId, environmentId, contentTypeId);
  const safeFields = filterToContentTypeFields(fields, allowed);

  const mergedFields = { ...(existing.fields ?? {}) } as Record<string, Record<string, unknown>>;

  for (const [k, v] of Object.entries(safeFields)) {
    mergedFields[k] = { ...(mergedFields[k] ?? {}), [entryLocale]: v };
  }

  return client.entry.update({ spaceId, environmentId, entryId }, { ...existing, fields: mergedFields });
}

export async function managementDeleteEntry(clients: ContentfulClients, entryId: string) {
  const { managementClient: client, spaceId, environmentId } = clients;
  await client.entry.delete({ spaceId, environmentId, entryId });
}

export async function managementPublishEntry(clients: ContentfulClients, entryId: string) {
  const { managementClient: client, spaceId, environmentId } = clients;
  const entry = await client.entry.get({ spaceId, environmentId, entryId });
  return client.entry.publish({ spaceId, environmentId, entryId }, entry);
}

export async function managementUnpublishEntry(clients: ContentfulClients, entryId: string) {
  const { managementClient: client, spaceId, environmentId } = clients;
  const entry = await client.entry.get({ spaceId, environmentId, entryId });
  return client.entry.unpublish({ spaceId, environmentId, entryId }, entry);
}
