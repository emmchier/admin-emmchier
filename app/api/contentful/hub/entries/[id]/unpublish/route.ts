import { jsonError, jsonOk, getHubCtx } from '../../../_shared';
import { logCMAOperation } from '@/lib/contentful/logCmaOperation';

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { client, spaceId, environmentId } = getHubCtx();
    const { id: entryId } = await ctx.params;
    const entry = await client.entry.get({ spaceId, environmentId, entryId });
    const contentTypeId = entry?.sys?.contentType?.sys?.id ? String(entry.sys.contentType.sys.id) : null;
    const unpublished = await client.entry.unpublish({ spaceId, environmentId, entryId }, entry);
    logCMAOperation({ action: 'UNPUBLISH', contentType: contentTypeId, entryId, response: { sys: unpublished?.sys } });
    return jsonOk({ item: unpublished });
  } catch (e) {
    const { id } = await ctx.params.catch(() => ({ id: '' as any }));
    logCMAOperation({ action: 'UNPUBLISH', entryId: id ? String(id) : null, error: e });
    return jsonError(e, 500);
  }
}
