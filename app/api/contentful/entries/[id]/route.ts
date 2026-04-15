import { jsonError, jsonOk, getCtx } from '../../_shared';

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
    const mergedFields = { ...(existing.fields ?? {}) } as Record<string, any>;

    for (const [k, v] of Object.entries(body.fields)) {
      mergedFields[k] = { ...(mergedFields[k] ?? {}), [entryLocale]: v };
    }

    const updated = await client.entry.update(
      { spaceId, environmentId, entryId },
      { ...existing, fields: mergedFields },
    );

    return jsonOk({ item: updated });
  } catch (e) {
    return jsonError(e, 500);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { client, spaceId, environmentId } = getCtx();
    const { id: entryId } = await ctx.params;
    await client.entry.delete({ spaceId, environmentId, entryId });
    return jsonOk({ ok: true });
  } catch (e) {
    return jsonError(e, 500);
  }
}

