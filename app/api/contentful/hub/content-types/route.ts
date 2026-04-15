import { jsonError, jsonOk, getHubCtx } from '../_shared';

export async function GET() {
  try {
    const { client, spaceId, environmentId } = getHubCtx();
    const res = await client.contentType.getMany({
      spaceId,
      environmentId,
      query: { limit: 1000 },
    });
    return jsonOk({ items: res.items });
  } catch (e) {
    return jsonError(e, 500);
  }
}
