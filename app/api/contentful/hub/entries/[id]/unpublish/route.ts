import { jsonError, jsonOk, getHubCtx } from '../../../_shared';

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { client, spaceId, environmentId } = getHubCtx();
    const { id: entryId } = await ctx.params;
    const entry = await client.entry.get({ spaceId, environmentId, entryId });
    const unpublished = await client.entry.unpublish({ spaceId, environmentId, entryId }, entry);
    return jsonOk({ item: unpublished });
  } catch (e) {
    return jsonError(e, 500);
  }
}
