import { jsonError, jsonOk, getHubCtx } from '../../../_shared';

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { client, spaceId, environmentId } = getHubCtx();
    const { id: entryId } = await ctx.params;
    const entry = await client.entry.get({ spaceId, environmentId, entryId });
    const published = await client.entry.publish({ spaceId, environmentId, entryId }, entry);
    return jsonOk({ item: published });
  } catch (e) {
    return jsonError(e, 500);
  }
}
