import { jsonError, jsonOk, getHubCtx, parseIntParam } from '../_shared';
import { logCMAOperation } from '@/lib/contentful/logCmaOperation';

export async function GET(req: Request) {
  try {
    const { client, spaceId, environmentId } = getHubCtx();
    const url = new URL(req.url);
    const contentType = url.searchParams.get('contentType');
    const skip = parseIntParam(url.searchParams.get('skip'), 0);
    const limit = parseIntParam(url.searchParams.get('limit'), 50);
    const q = url.searchParams.get('q');

    if (!contentType) return jsonError(new Error('Missing contentType'), 400);

    const query: Record<string, string | number> = {
      content_type: contentType,
      skip,
      limit,
      order: '-sys.updatedAt',
    };

    if (q) query.query = q;

    const res = await client.entry.getMany({ spaceId, environmentId, query });
    return jsonOk({ items: res.items, total: res.total, skip: res.skip, limit: res.limit });
  } catch (e) {
    return jsonError(e, 500);
  }
}

export async function POST(req: Request) {
  try {
    const { client, spaceId, environmentId, entryLocale } = getHubCtx();
    const body = (await req.json()) as {
      contentTypeId: string;
      fields: Record<string, unknown>;
    };

    if (!body?.contentTypeId) return jsonError(new Error('Missing contentTypeId'), 400);
    if (!body?.fields) return jsonError(new Error('Missing fields'), 400);

    const localizedFields: Record<string, Record<string, unknown>> = {};
    for (const [k, v] of Object.entries(body.fields)) {
      localizedFields[k] = { [entryLocale]: v };
    }

    const created = await client.entry.create(
      { spaceId, environmentId, contentTypeId: body.contentTypeId },
      { fields: localizedFields },
    );

    logCMAOperation({
      action: 'CREATE',
      contentType: body.contentTypeId,
      entryId: created?.sys?.id ? String(created.sys.id) : null,
      payload: { fields: body.fields },
      response: { sys: created?.sys },
    });
    return jsonOk({ item: created }, { status: 201 });
  } catch (e) {
    logCMAOperation({ action: 'CREATE', contentType: null, entryId: null, error: e });
    return jsonError(e, 500);
  }
}
