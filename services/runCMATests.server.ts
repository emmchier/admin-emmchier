import 'server-only';

import { contentfulService } from '@/services/contentfulService';

type EntityKey = 'project' | 'category' | 'navigationGroup' | 'tech' | 'contact' | 'experience';
type CMATestCaseStatus = 'ok' | 'fail' | 'skip';

export type CMATestResult = {
  entity: EntityKey;
  entryId?: string | null;
  create: CMATestCaseStatus;
  update: CMATestCaseStatus;
  publish: CMATestCaseStatus;
  delete: CMATestCaseStatus;
  error?: string;
};

function nowId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toSlug(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function asId(x: any): string | null {
  const id = x?.sys?.id ? String(x.sys.id) : null;
  return id && id.trim() ? id : null;
}

function isPublished(entry: any): boolean {
  return Boolean(entry?.sys?.publishedAt);
}

function requiredFieldsFromContentType(contentTypes: any[], contentTypeId: string) {
  const ct = contentTypes.find((x) => x?.sys?.id === contentTypeId);
  const fields = Array.isArray(ct?.fields) ? ct.fields : [];
  return fields.filter((f: any) => f && f.required);
}

function makeEntryLink(entryId: string) {
  return { sys: { type: 'Link', linkType: 'Entry', id: entryId } };
}

async function resolveRequiredLink(space: 'art' | 'hub', linkContentType: string): Promise<unknown | null> {
  // Use existing content as read-only reference to avoid creating dependency chains.
  const items = await contentfulService.getEntriesCached({ space, contentTypeId: linkContentType });
  const first = Array.isArray(items) ? items[0] : null;
  const id = first?.sys?.id ? String(first.sys.id) : '';
  return id ? makeEntryLink(id) : null;
}

async function mockRequiredField(space: 'art' | 'hub', f: any, seed: string): Promise<{ ok: boolean; value?: unknown; reason?: string }> {
  const type = String(f?.type ?? '');
  const id = String(f?.id ?? '');
  if (!type || !id) return { ok: false, reason: 'Invalid field descriptor' };

  if (type === 'Link') {
    if (String(f?.linkType ?? '') !== 'Entry') return { ok: false, reason: `Required Link(${String(f?.linkType)}) not supported` };
    const allowed = Array.isArray(f?.validations) ? f.validations : [];
    const linkContentType = allowed.find((v: any) => Array.isArray(v?.linkContentType))?.linkContentType?.[0];
    if (!linkContentType) return { ok: false, reason: `Required Link field '${id}' missing linkContentType validation` };
    const link = await resolveRequiredLink(space, String(linkContentType));
    if (!link) return { ok: false, reason: `No existing entry found for required link '${id}' -> ${String(linkContentType)}` };
    return { ok: true, value: link };
  }

  if (type === 'Array') {
    const itemType = String(f?.items?.type ?? '');
    if (itemType === 'Link') {
      const linkType = String(f?.items?.linkType ?? '');
      if (linkType !== 'Entry') return { ok: false, reason: `Required Link array(${linkType}) not supported` };
      const allowed = Array.isArray(f?.items?.validations) ? f.items.validations : [];
      const linkContentType = allowed.find((v: any) => Array.isArray(v?.linkContentType))?.linkContentType?.[0];
      if (!linkContentType) return { ok: false, reason: `Required Link array field '${id}' missing linkContentType validation` };
      const link = await resolveRequiredLink(space, String(linkContentType));
      if (!link) return { ok: false, reason: `No existing entry found for required link array '${id}' -> ${String(linkContentType)}` };
      return { ok: true, value: [link] };
    }
    return { ok: true, value: [] };
  }

  if (type === 'Symbol' || type === 'Text') return { ok: true, value: `[CMA_TEST] ${seed} ${id}` };
  if (type === 'Integer' || type === 'Number') return { ok: true, value: 1 };
  if (type === 'Boolean') return { ok: true, value: false };
  if (type === 'Date') return { ok: true, value: '2026-01-01' };
  if (type === 'Object') return { ok: true, value: { test: true, seed } };

  return { ok: false, reason: `Unsupported required field type '${type}' for '${id}'` };
}

async function runOneEntity(args: {
  entity: EntityKey;
  space: 'art' | 'hub';
  contentTypeId: string;
  createFields: Record<string, unknown>;
  updateFields: Record<string, unknown>;
  shouldPublish: boolean;
}) {
  const { entity, space, contentTypeId, createFields, updateFields, shouldPublish } = args;

  const res: CMATestResult = {
    entity,
    entryId: null,
    create: 'fail',
    update: 'skip',
    publish: 'skip',
    delete: 'skip',
  };

  let entryId: string | null = null;

  try {
    const created = await contentfulService.createEntry({ space, contentTypeId, fields: createFields });
    entryId = asId(created);
    res.entryId = entryId;
    if (!entryId) throw new Error('Missing sys.id on create response');
    res.create = 'ok';

    const updated = await contentfulService.updateEntry({ space, entryId, fields: updateFields });
    if (!asId(updated)) throw new Error('Missing sys.id on update response');
    const loadedAfterUpdate = await contentfulService.getEntryById({ space, entryId });
    for (const k of Object.keys(updateFields)) {
      if (!(k in (loadedAfterUpdate?.fields ?? {}))) throw new Error(`Updated field missing in entry: ${k}`);
    }
    res.update = 'ok';

    if (shouldPublish) {
      const published = await contentfulService.publishEntry({ space, entryId });
      const loadedAfterPublish = await contentfulService.getEntryById({ space, entryId });
      if (!isPublished(published) && !isPublished(loadedAfterPublish)) throw new Error('publish did not set sys.publishedAt');
      res.publish = 'ok';
    } else {
      res.publish = 'skip';
    }

    // Contentful cannot delete published entries; unpublish first when needed.
    const latest = await contentfulService.getEntryById({ space, entryId });
    if (isPublished(latest)) {
      await contentfulService.unpublishEntry({ space, entryId });
    }

    await contentfulService.deleteEntry({ space, entryId });
    res.delete = 'ok';
    return res;
  } catch (e) {
    res.error = e instanceof Error ? e.message : 'Unknown error';
    if (entryId) {
      try {
        await contentfulService.deleteEntry({ space, entryId });
        res.delete = 'ok';
      } catch {
        res.delete = res.delete === 'ok' ? 'ok' : 'fail';
      }
    }
    if (res.update === 'skip' && res.create === 'ok') res.update = 'fail';
    if (res.publish === 'skip' && shouldPublish && res.create === 'ok') res.publish = 'fail';
    return res;
  }
}

export async function runCMATestsServer(): Promise<{ results: CMATestResult[]; summary: { ok: number; fail: number; skip: number } }> {
  const seed = nowId();

  const artContentTypes = await contentfulService.getContentTypes({ space: 'art' });

  const buildArtCreateFields = async (contentTypeId: string, overrides: Record<string, unknown>) => {
    const required = requiredFieldsFromContentType(artContentTypes, contentTypeId);
    const fields: Record<string, unknown> = {};
    const reasons: string[] = [];
    for (const f of required) {
      const m = await mockRequiredField('art', f, seed);
      if (!m.ok) reasons.push(m.reason || 'Unknown');
      else fields[String(f.id)] = m.value;
    }
    // Overrides must win (e.g. title/slug uniqueness)
    return {
      fields: { ...fields, ...overrides },
      publishOk: reasons.length === 0,
      publishSkipReason: reasons.join('; '),
    };
  };

  const tests: Array<Promise<CMATestResult>> = [
    (async () => {
      const overrides = { title: `[CMA_TEST] Project ${seed}`, slug: toSlug(`cma-test-project-${seed}`) };
      const built = await buildArtCreateFields('project', overrides);
      const r = await runOneEntity({
        entity: 'project',
        space: 'art',
        contentTypeId: 'project',
        createFields: built.fields,
        updateFields: { title: `${overrides.title} (updated)` },
        shouldPublish: built.publishOk,
      });
      if (!built.publishOk) {
        r.publish = 'skip';
        r.error = r.error ? `${r.error}; publish skipped: ${built.publishSkipReason}` : `publish skipped: ${built.publishSkipReason}`;
      }
      return r;
    })(),
    (async () => {
      const overrides = { title: `[CMA_TEST] Category ${seed}`, slug: toSlug(`cma-test-category-${seed}`) };
      const built = await buildArtCreateFields('category', overrides);
      const r = await runOneEntity({
        entity: 'category',
        space: 'art',
        contentTypeId: 'category',
        createFields: built.fields,
        updateFields: { title: `${overrides.title} (updated)` },
        shouldPublish: built.publishOk,
      });
      if (!built.publishOk) {
        r.publish = 'skip';
        r.error = r.error ? `${r.error}; publish skipped: ${built.publishSkipReason}` : `publish skipped: ${built.publishSkipReason}`;
      }
      return r;
    })(),
    (async () => {
      const overrides = { title: `[CMA_TEST] Project group ${seed}` };
      const built = await buildArtCreateFields('navigationGroup', overrides);
      const r = await runOneEntity({
        entity: 'navigationGroup',
        space: 'art',
        contentTypeId: 'navigationGroup',
        createFields: built.fields,
        updateFields: { title: `${overrides.title} (updated)` },
        shouldPublish: built.publishOk,
      });
      if (!built.publishOk) {
        r.publish = 'skip';
        r.error = r.error ? `${r.error}; publish skipped: ${built.publishSkipReason}` : `publish skipped: ${built.publishSkipReason}`;
      }
      return r;
    })(),
    (async () => {
      const overrides = { name: `[CMA_TEST] Tech ${seed}`, slug: toSlug(`cma-test-tech-${seed}`) };
      const built = await buildArtCreateFields('tech', overrides);
      const r = await runOneEntity({
        entity: 'tech',
        space: 'art',
        contentTypeId: 'tech',
        createFields: built.fields,
        updateFields: { name: `${overrides.name} (updated)` },
        shouldPublish: built.publishOk,
      });
      if (!built.publishOk) {
        r.publish = 'skip';
        r.error = r.error ? `${r.error}; publish skipped: ${built.publishSkipReason}` : `publish skipped: ${built.publishSkipReason}`;
      }
      return r;
    })(),
  ];

  // HUB required fields are inferred live to avoid hardcoding.
  const hubContentTypes = await contentfulService.getContentTypes({ space: 'hub' });

  for (const entity of ['contact', 'experience'] as const) {
    const required = requiredFieldsFromContentType(hubContentTypes, entity);
    const createFields: Record<string, unknown> = {};
    const reasons: string[] = [];
    for (const f of required) {
      const m = await mockRequiredField('hub', f, seed);
      if (!m.ok) reasons.push(m.reason || 'Unknown');
      else createFields[String(f.id)] = m.value;
    }
    const canPublish = reasons.length === 0;
    const updateFields = Object.keys(createFields).length ? { [Object.keys(createFields)[0]]: `[CMA_TEST] ${seed} updated` } : {};

    tests.push(
      runOneEntity({ entity, space: 'hub', contentTypeId: entity, createFields, updateFields, shouldPublish: canPublish }).then((r) => {
        if (!canPublish) {
          r.publish = 'skip';
          r.error = r.error ? `${r.error}; publish skipped: ${reasons.join('; ')}` : `publish skipped: ${reasons.join('; ')}`;
        }
        return r;
      }),
    );
  }

  const results = await Promise.all(tests);
  const summary = results.reduce(
    (acc, r) => {
      for (const k of ['create', 'update', 'publish', 'delete'] as const) acc[r[k]] += 1;
      return acc;
    },
    { ok: 0, fail: 0, skip: 0 } as Record<CMATestCaseStatus, number>,
  );

  return { results, summary };
}

