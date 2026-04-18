import { jsonError, jsonOk, getCtx } from '../../_shared';
import { logCMAOperation } from '@/lib/contentful/logCmaOperation';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { client, spaceId, environmentId } = getCtx();
    const { id: entryId } = await ctx.params;
    const item = await client.entry.get({ spaceId, environmentId, entryId });
    return jsonOk({ item });
  } catch (e) {
    return jsonError(e, 500);
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { client, spaceId, environmentId, entryLocale } = getCtx();
    const { id: entryId } = await ctx.params;
    const body = (await req.json()) as { fields: Record<string, unknown> };
    if (!body?.fields) return jsonError(new Error('Missing fields'), 400);

    const existing = await client.entry.get({ spaceId, environmentId, entryId });
    const contentTypeId = existing?.sys?.contentType?.sys?.id ? String(existing.sys.contentType.sys.id) : null;
    const mergedFields = { ...(existing.fields ?? {}) } as Record<string, any>;

    for (const [k, v] of Object.entries(body.fields)) {
      mergedFields[k] = { ...(mergedFields[k] ?? {}), [entryLocale]: v };
    }

    const updated = await client.entry.update(
      { spaceId, environmentId, entryId },
      { ...existing, fields: mergedFields },
    );

    logCMAOperation({
      action: 'UPDATE',
      contentType: contentTypeId,
      entryId,
      payload: { fields: body.fields },
      response: { sys: updated?.sys },
    });
    return jsonOk({ item: updated });
  } catch (e) {
    const { id } = await ctx.params.catch(() => ({ id: '' as any }));
    logCMAOperation({ action: 'UPDATE', entryId: id ? String(id) : null, error: e });
    return jsonError(e, 500);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { client, spaceId, environmentId } = getCtx();
    const { id: entryId } = await ctx.params;
    await client.entry.delete({ spaceId, environmentId, entryId });
    logCMAOperation({ action: 'DELETE', entryId, response: { ok: true } });
    return jsonOk({ ok: true });
  } catch (e) {
    const { id } = await ctx.params.catch(() => ({ id: '' as any }));
    logCMAOperation({ action: 'DELETE', entryId: id ? String(id) : null, error: e });
    return jsonError(e, 500);
  }
}

