import { jsonError, jsonOk, getCtx } from '../../../_shared';
import { logCMAOperation } from '@/lib/contentful/logCmaOperation';

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { client, spaceId, environmentId } = getCtx();
    const { id: entryId } = await ctx.params;
    const entry = await client.entry.get({ spaceId, environmentId, entryId });
    const contentTypeId = entry?.sys?.contentType?.sys?.id ? String(entry.sys.contentType.sys.id) : null;
    const published = await client.entry.publish({ spaceId, environmentId, entryId }, entry);
    logCMAOperation({ action: 'PUBLISH', contentType: contentTypeId, entryId, response: { sys: published?.sys } });
    return jsonOk({ item: published });
  } catch (e) {
    const { id } = await ctx.params.catch(() => ({ id: '' as any }));
    logCMAOperation({ action: 'PUBLISH', entryId: id ? String(id) : null, error: e });
    return jsonError(e, 500);
  }
}

