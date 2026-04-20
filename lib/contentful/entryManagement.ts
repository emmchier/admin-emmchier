import 'server-only';

import type { PlainClientAPI } from 'contentful-management';
import type { ContentfulClients } from '@/lib/contentful/clients';
import { isEntryPublished } from '@/lib/contentful/isEntryPublished';
import { logCMAOperation } from '@/lib/contentful/logCmaOperation';

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

  try {
    const allowed = await allowedFieldIds(client, spaceId, environmentId, contentTypeId);
    const safeFields = filterToContentTypeFields(fields, allowed);
    const localizedFields = localizeFieldsMap(safeFields, entryLocale);

    const created = await client.entry.create({ spaceId, environmentId, contentTypeId }, { fields: localizedFields });
    logCMAOperation({
      action: 'CREATE',
      contentType: contentTypeId,
      entryId: created?.sys?.id ? String(created.sys.id) : null,
      payload: { fields: safeFields },
      response: { sys: created?.sys },
    });
    return created;
  } catch (error) {
    logCMAOperation({
      action: 'CREATE',
      contentType: contentTypeId,
      entryId: null,
      payload: { fields },
      error,
    });
    throw error;
  }
}

export async function managementUpdateEntry(
  clients: ContentfulClients,
  entryLocale: string,
  args: { entryId: string; fields: Record<string, JsonValue> },
) {
  const { entryId, fields } = args;
  const { managementClient: client, spaceId, environmentId } = clients;

  let contentTypeId: string | null = null;
  try {
    const existing = await client.entry.get({ spaceId, environmentId, entryId });
    contentTypeId = existing?.sys?.contentType?.sys?.id ? String(existing.sys.contentType.sys.id) : null;
    const allowed = await allowedFieldIds(client, spaceId, environmentId, String(contentTypeId || ''));
    const safeFields = filterToContentTypeFields(fields, allowed);

    const mergedFields = { ...(existing.fields ?? {}) } as Record<string, Record<string, unknown>>;
    for (const [k, v] of Object.entries(safeFields)) {
      mergedFields[k] = { ...(mergedFields[k] ?? {}), [entryLocale]: v };
    }

    const updated = await client.entry.update({ spaceId, environmentId, entryId }, { ...existing, fields: mergedFields });
    logCMAOperation({
      action: 'UPDATE',
      contentType: contentTypeId,
      entryId,
      payload: { fields: safeFields },
      response: { sys: updated?.sys },
    });
    return updated;
  } catch (error) {
    logCMAOperation({
      action: 'UPDATE',
      contentType: contentTypeId,
      entryId,
      payload: { fields },
      error,
    });
    throw error;
  }
}

export async function managementDeleteEntry(clients: ContentfulClients, entryId: string) {
  const { managementClient: client, spaceId, environmentId } = clients;
  let contentTypeId: string | null = null;
  try {
    const entry = await client.entry.get({ spaceId, environmentId, entryId });
    contentTypeId = entry?.sys?.contentType?.sys?.id ? String(entry.sys.contentType.sys.id) : null;

    /** CMA rejects delete on published entries ("Cannot delete published"). */
    if (isEntryPublished(entry.sys)) {
      await client.entry.unpublish({ spaceId, environmentId, entryId }, entry);
      logCMAOperation({
        action: 'UNPUBLISH',
        contentType: contentTypeId,
        entryId,
        response: { ok: true, reason: 'before_delete' },
      });
    }

    await client.entry.delete({ spaceId, environmentId, entryId });
    logCMAOperation({
      action: 'DELETE',
      contentType: contentTypeId,
      entryId,
      response: { ok: true },
    });
  } catch (error) {
    logCMAOperation({ action: 'DELETE', contentType: contentTypeId, entryId, error });
    throw error;
  }
}

export async function managementPublishEntry(clients: ContentfulClients, entryId: string) {
  const { managementClient: client, spaceId, environmentId } = clients;
  let contentTypeId: string | null = null;
  try {
    const entry = await client.entry.get({ spaceId, environmentId, entryId });
    contentTypeId = entry?.sys?.contentType?.sys?.id ? String(entry.sys.contentType.sys.id) : null;
    const published = await client.entry.publish({ spaceId, environmentId, entryId }, entry);
    logCMAOperation({ action: 'PUBLISH', contentType: contentTypeId, entryId, response: { sys: published?.sys } });
    return published;
  } catch (error) {
    logCMAOperation({ action: 'PUBLISH', contentType: contentTypeId, entryId, error });
    throw error;
  }
}

export async function managementUnpublishEntry(clients: ContentfulClients, entryId: string) {
  const { managementClient: client, spaceId, environmentId } = clients;
  let contentTypeId: string | null = null;
  try {
    const entry = await client.entry.get({ spaceId, environmentId, entryId });
    contentTypeId = entry?.sys?.contentType?.sys?.id ? String(entry.sys.contentType.sys.id) : null;
    const unpublished = await client.entry.unpublish({ spaceId, environmentId, entryId }, entry);
    logCMAOperation({ action: 'UNPUBLISH', contentType: contentTypeId, entryId, response: { sys: unpublished?.sys } });
    return unpublished;
  } catch (error) {
    // Contentful returns 400 "Not published" if we try to unpublish a draft.
    // Treat as a no-op to keep UI flows resilient.
    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('Not published')) {
      logCMAOperation({ action: 'UNPUBLISH', contentType: contentTypeId, entryId, response: { ok: true, noop: true } });
      return { sys: { id: entryId } } as any;
    }
    logCMAOperation({ action: 'UNPUBLISH', contentType: contentTypeId, entryId, error });
    throw error;
  }
}
