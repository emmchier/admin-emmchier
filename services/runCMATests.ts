'use client';

import { contentfulService } from '@/services/contentfulService';

type EntityKey = 'project' | 'category' | 'navigationGroup' | 'tech' | 'contact' | 'experience';

export type CMATestCaseStatus = 'ok' | 'fail' | 'skip';

export type CMATestResult = {
  entity: EntityKey;
  entryId?: string | null;
  create: CMATestCaseStatus;
  update: CMATestCaseStatus;
  publish: CMATestCaseStatus;
  delete: CMATestCaseStatus;
  error?: string;
  details?: unknown;
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

function makeMockForRequiredField(f: any, seed: string): { ok: boolean; value?: unknown; reason?: string } {
  const type = String(f?.type ?? '');
  const id = String(f?.id ?? '');
  if (!type || !id) return { ok: false, reason: 'Invalid field descriptor' };

  // Avoid creating linked dependencies automatically (safety).
  if (type === 'Link') return { ok: false, reason: `Required Link field '${id}' not supported in tests` };
  if (type === 'Array') {
    const itemType = String(f?.items?.type ?? '');
    if (itemType === 'Link') return { ok: false, reason: `Required Link array field '${id}' not supported in tests` };
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
    // Best-effort assert: the updated keys exist in fields (localized in API layer).
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

    await contentfulService.deleteEntry({ space, entryId });
    res.delete = 'ok';
    return res;
  } catch (e) {
    res.error = e instanceof Error ? e.message : 'Unknown error';
    res.details = e;
    // Ensure cleanup even on partial failures.
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

export async function runCMATests(): Promise<{ results: CMATestResult[]; summary: { ok: number; fail: number; skip: number } }> {
  // Safety gate: never run accidentally.
  if (process.env.NEXT_PUBLIC_ENABLE_CMA_TESTS !== 'true') {
    const msg = 'CMA tests are disabled. Set NEXT_PUBLIC_ENABLE_CMA_TESTS=true to run.';
    // eslint-disable-next-line no-console
    console.warn(msg);
    return {
      results: [
        {
          entity: 'project',
          create: 'skip',
          update: 'skip',
          publish: 'skip',
          delete: 'skip',
          error: msg,
        },
      ],
      summary: { ok: 0, fail: 0, skip: 4 },
    };
  }

  const seed = nowId();

  // ART: required fields known from export.
  const artProjectTitle = `[CMA_TEST] Project ${seed}`;
  const artProjectSlug = toSlug(`cma-test-project-${seed}`);

  const artCategoryTitle = `[CMA_TEST] Category ${seed}`;
  const artCategorySlug = toSlug(`cma-test-category-${seed}`);

  const artNavTitle = `[CMA_TEST] Project group ${seed}`;

  const artTechName = `[CMA_TEST] Tech ${seed}`;
  const artTechSlug = toSlug(`cma-test-tech-${seed}`);

  // HUB: infer required fields from content types.
  const hubContentTypes = await contentfulService.getContentTypes({ space: 'hub' });

  const buildHubCreateFields = (contentTypeId: string): { fields: Record<string, unknown>; publishOk: boolean; publishSkipReason?: string } => {
    const required = requiredFieldsFromContentType(hubContentTypes, contentTypeId);
    const fields: Record<string, unknown> = {};
    const reasons: string[] = [];
    for (const f of required) {
      const m = makeMockForRequiredField(f, seed);
      if (!m.ok) reasons.push(m.reason || 'Unknown');
      else fields[String(f.id)] = m.value;
    }
    const publishOk = reasons.length === 0;
    return { fields, publishOk, publishSkipReason: publishOk ? undefined : reasons.join('; ') };
  };

  const hubContact = buildHubCreateFields('contact');
  const hubExperience = buildHubCreateFields('experience');

  const tests: Array<Promise<CMATestResult>> = [
    runOneEntity({
      entity: 'project',
      space: 'art',
      contentTypeId: 'project',
      createFields: { title: artProjectTitle, slug: artProjectSlug },
      updateFields: { title: `${artProjectTitle} (updated)` },
      shouldPublish: true,
    }),
    runOneEntity({
      entity: 'category',
      space: 'art',
      contentTypeId: 'category',
      createFields: { title: artCategoryTitle, slug: artCategorySlug },
      updateFields: { title: `${artCategoryTitle} (updated)` },
      shouldPublish: true,
    }),
    runOneEntity({
      entity: 'navigationGroup',
      space: 'art',
      contentTypeId: 'navigationGroup',
      createFields: { title: artNavTitle },
      updateFields: { title: `${artNavTitle} (updated)` },
      shouldPublish: true,
    }),
    runOneEntity({
      entity: 'tech',
      space: 'art',
      contentTypeId: 'tech',
      createFields: { name: artTechName, slug: artTechSlug },
      updateFields: { name: `${artTechName} (updated)` },
      shouldPublish: true,
    }),
    runOneEntity({
      entity: 'contact',
      space: 'hub',
      contentTypeId: 'contact',
      createFields: hubContact.fields,
      updateFields: Object.keys(hubContact.fields).length ? { [Object.keys(hubContact.fields)[0]]: `[CMA_TEST] ${seed} updated` } : {},
      shouldPublish: hubContact.publishOk,
    }).then((r) => {
      if (!hubContact.publishOk) {
        r.publish = 'skip';
        r.error = r.error ? `${r.error}; publish skipped: ${hubContact.publishSkipReason}` : `publish skipped: ${hubContact.publishSkipReason}`;
      }
      return r;
    }),
    runOneEntity({
      entity: 'experience',
      space: 'hub',
      contentTypeId: 'experience',
      createFields: hubExperience.fields,
      updateFields: Object.keys(hubExperience.fields).length ? { [Object.keys(hubExperience.fields)[0]]: `[CMA_TEST] ${seed} updated` } : {},
      shouldPublish: hubExperience.publishOk,
    }).then((r) => {
      if (!hubExperience.publishOk) {
        r.publish = 'skip';
        r.error = r.error ? `${r.error}; publish skipped: ${hubExperience.publishSkipReason}` : `publish skipped: ${hubExperience.publishSkipReason}`;
      }
      return r;
    }),
  ];

  const results = await Promise.all(tests);

  const summary = results.reduce(
    (acc, r) => {
      for (const k of ['create', 'update', 'publish', 'delete'] as const) {
        acc[r[k]] += 1;
      }
      return acc;
    },
    { ok: 0, fail: 0, skip: 0 } as Record<CMATestCaseStatus, number>,
  );

  // eslint-disable-next-line no-console
  console.group('[CMA TESTS] Report');
  // eslint-disable-next-line no-console
  console.table(
    results.map((r) => ({
      entity: r.entity,
      id: r.entryId || '',
      create: r.create,
      update: r.update,
      publish: r.publish,
      delete: r.delete,
      error: r.error || '',
    })),
  );
  // eslint-disable-next-line no-console
  console.log('[CMA TESTS] Summary', summary);
  // eslint-disable-next-line no-console
  console.groupEnd();

  return { results, summary };
}

