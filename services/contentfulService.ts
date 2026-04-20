import { useContentfulStore } from '@/lib/store/contentfulStore';
import { useHubStore } from '@/lib/store/hubStore';
import { logCMAOperation } from '@/lib/contentful/logCmaOperation';
import type { SpaceId } from '@/lib/spaces';

type ListArgs = {
  space: SpaceId;
  contentTypeId: string;
  /** Optional full-text query (CMA `query` / our proxy `q`) */
  q?: string;
  limit?: number;
  skip?: number;
};

function inferSpaceFromManagementApiRoot(managementApiRoot: string | undefined): SpaceId {
  const root = (managementApiRoot || '/api/contentful').trim();
  if (root.includes('/hub')) return 'hub';
  if (root.includes('/design')) return 'design';
  return 'art';
}

function baseFor(space: SpaceId): string {
  if (space === 'hub') return '/api/contentful/hub';
  if (space === 'design') return '/api/contentful/design';
  return '/api/contentful';
}

function recordSize(rec: Record<string, unknown> | null | undefined): number {
  return rec ? Object.keys(rec).length : 0;
}

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const origin =
    typeof window !== 'undefined'
      ? ''
      : (process.env.CONTENTFUL_SERVICE_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').trim();
  const finalUrl = origin ? new URL(url, origin).toString() : url;

  const res = await fetch(finalUrl, { cache: 'no-store', ...init });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data?.error || 'Contentful request failed');
  return data;
}

function toastIfClient(kind: 'success' | 'error', message: string) {
  if (typeof window === 'undefined') return;
  // Lazy import to avoid bundling toast into server contexts.
  void import('@/lib/ui/snackbar').then(({ toast }) => {
    if (kind === 'success') toast.success(message);
    else toast.error(message);
  });
}

/** Centralized Contentful access layer (Zustand-first). */
export const contentfulService = {
  inferSpaceFromManagementApiRoot,

  async listEntries(args: ListArgs): Promise<any[]> {
    const { space, contentTypeId } = args;
    const q = args.q?.trim() ? args.q.trim() : undefined;
    const limit = typeof args.limit === 'number' ? args.limit : 500;
    const skip = typeof args.skip === 'number' ? args.skip : 0;

    const url = new URL(`${baseFor(space)}/entries`, 'http://local');
    url.searchParams.set('contentType', contentTypeId);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('skip', String(skip));
    if (q) url.searchParams.set('q', q);

    const data = await fetchJson(url.pathname + url.search);
    return (data?.items ?? []) as any[];
  },

  /**
   * Store-first list helper. For known content types, this is the preferred API:
   * - returns Zustand data if already loaded (even if empty)
   * - otherwise fetches, saves into Zustand, returns items
   */
  async getEntriesCached(args: { space: SpaceId; contentTypeId: string; force?: boolean }): Promise<any[]> {
    const { space, contentTypeId } = args;
    const force = Boolean(args.force);
    if (space === 'art') {
      const s = useContentfulStore.getState();
      if (contentTypeId === 'project') {
        if (!force && s.loadedModels.project) return Object.values(s.projects);
        const items = await this.listEntries({ space, contentTypeId, limit: 1000 });
        s.setProjects(items as any);
        return Object.values(useContentfulStore.getState().projects);
      }
      if (contentTypeId === 'category') {
        if (!force && s.loadedModels.category) return Object.values(s.categories);
        const items = await this.listEntries({ space, contentTypeId, limit: 1000 });
        s.setCategories(items as any);
        return Object.values(useContentfulStore.getState().categories);
      }
      if (contentTypeId === 'navigationGroup') {
        if (!force && s.loadedModels.navigationGroup) return Object.values(s.navigationGroups);
        const items = await this.listEntries({ space, contentTypeId, limit: 1000 });
        s.setNavigationGroups(items as any);
        return Object.values(useContentfulStore.getState().navigationGroups);
      }
      if (contentTypeId === 'tech') {
        if (!force && s.loadedModels.tech) return Object.values(s.techs);
        const items = await this.listEntries({ space, contentTypeId, limit: 1000 });
        s.setTechs(items as any);
        return Object.values(useContentfulStore.getState().techs);
      }
      // Unknown ART model: no store mapping yet.
      return await this.listEntries({ space, contentTypeId, limit: 1000 });
    }

    if (space === 'design') {
      return await this.listEntries({ space, contentTypeId, limit: 1000 });
    }

    const s = useHubStore.getState();
    if (contentTypeId === 'contact') {
      if (!force && s.loaded.contact) return Object.values(s.contacts);
      const items = await this.listEntries({ space, contentTypeId, limit: 1000 });
      s.setModel('contact', items as any);
      return Object.values(useHubStore.getState().contacts);
    }
    if (contentTypeId === 'experience') {
      if (!force && s.loaded.experience) return Object.values(s.experiences);
      const items = await this.listEntries({ space, contentTypeId, limit: 1000 });
      s.setModel('experience', items as any);
      return Object.values(useHubStore.getState().experiences);
    }
    if (contentTypeId === 'course') {
      if (!force && s.loaded.course) return Object.values(s.courses);
      const items = await this.listEntries({ space, contentTypeId, limit: 1000 });
      s.setModel('course', items as any);
      return Object.values(useHubStore.getState().courses);
    }
    if (contentTypeId === 'study') {
      if (!force && s.loaded.study) return Object.values(s.studies);
      const items = await this.listEntries({ space, contentTypeId, limit: 1000 });
      s.setModel('study', items as any);
      return Object.values(useHubStore.getState().studies);
    }
    if (contentTypeId === 'language') {
      if (!force && s.loaded.language) return Object.values(s.languages);
      const items = await this.listEntries({ space, contentTypeId, limit: 1000 });
      s.setModel('language', items as any);
      return Object.values(useHubStore.getState().languages);
    }
    if (contentTypeId === 'tech') {
      if (!force && s.loaded.tech) return Object.values(s.techs);
      const items = await this.listEntries({ space, contentTypeId, limit: 1000 });
      s.setModel('tech', items as any);
      return Object.values(useHubStore.getState().techs);
    }
    if (contentTypeId === 'resume') {
      if (!force && s.loaded.resume) return Object.values(s.resumes);
      const items = await this.listEntries({ space, contentTypeId, limit: 5 });
      s.setModel('resume', items as any);
      return Object.values(useHubStore.getState().resumes);
    }

    return await this.listEntries({ space, contentTypeId, limit: 1000 });
  },

  async getProjects() {
    return await this.getEntriesCached({ space: 'art', contentTypeId: 'project' });
  },

  async getCategories() {
    return await this.getEntriesCached({ space: 'art', contentTypeId: 'category' });
  },

  async getNavigationGroups() {
    return await this.getEntriesCached({ space: 'art', contentTypeId: 'navigationGroup' });
  },

  async getContacts() {
    return await this.getEntriesCached({ space: 'hub', contentTypeId: 'contact' });
  },

  async getExperiences() {
    return await this.getEntriesCached({ space: 'hub', contentTypeId: 'experience' });
  },

  async getCourses() {
    return await this.getEntriesCached({ space: 'hub', contentTypeId: 'course' });
  },

  async getStudies() {
    return await this.getEntriesCached({ space: 'hub', contentTypeId: 'study' });
  },

  async getLanguages() {
    return await this.getEntriesCached({ space: 'hub', contentTypeId: 'language' });
  },

  async getEntryById(args: { space: SpaceId; entryId: string }) {
    const { space, entryId } = args;
    const data = await fetchJson(`${baseFor(space)}/entries/${encodeURIComponent(entryId)}`);
    return data?.item;
  },

  async getContentTypes(args: { space: SpaceId }) {
    const { space } = args;
    const data = await fetchJson(`${baseFor(space)}/content-types`);
    return (data?.items ?? []) as any[];
  },

  async createEntry(args: { space: SpaceId; contentTypeId: string; fields: Record<string, unknown> }) {
    const { space, contentTypeId, fields } = args;
    try {
      const data = await fetchJson(`${baseFor(space)}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentTypeId, fields }),
      });
      const item = data?.item;
      const entryId = item?.sys?.id ? String(item.sys.id) : null;
      logCMAOperation({ action: 'CREATE', contentType: contentTypeId, entryId, payload: { fields }, response: { sys: item?.sys } });
      toastIfClient('success', 'Saved');
      return item;
    } catch (error) {
      logCMAOperation({ action: 'CREATE', contentType: contentTypeId, entryId: null, payload: { fields }, error });
      toastIfClient('error', error instanceof Error ? error.message : 'Failed to save');
      throw error;
    }
  },

  async publishEntry(args: { space: SpaceId; entryId: string }) {
    const { space, entryId } = args;
    try {
      const data = await fetchJson(`${baseFor(space)}/entries/${encodeURIComponent(entryId)}/publish`, { method: 'POST' });
      const item = data?.item;
      const contentTypeId = item?.sys?.contentType?.sys?.id ? String(item.sys.contentType.sys.id) : null;
      logCMAOperation({ action: 'PUBLISH', contentType: contentTypeId, entryId, response: { sys: item?.sys } });
      toastIfClient('success', 'Published');
      return item;
    } catch (error) {
      logCMAOperation({ action: 'PUBLISH', contentType: null, entryId, error });
      toastIfClient('error', error instanceof Error ? error.message : 'Failed to publish');
      throw error;
    }
  },

  async unpublishEntry(args: { space: SpaceId; entryId: string }) {
    const { space, entryId } = args;
    try {
      const data = await fetchJson(`${baseFor(space)}/entries/${encodeURIComponent(entryId)}/unpublish`, { method: 'POST' });
      const item = data?.item;
      const contentTypeId = item?.sys?.contentType?.sys?.id ? String(item.sys.contentType.sys.id) : null;
      logCMAOperation({ action: 'UNPUBLISH', contentType: contentTypeId, entryId, response: { sys: item?.sys } });
      toastIfClient('success', 'Unpublished');
      return item;
    } catch (error) {
      logCMAOperation({ action: 'UNPUBLISH', contentType: null, entryId, error });
      toastIfClient('error', error instanceof Error ? error.message : 'Failed to unpublish');
      throw error;
    }
  },

  async updateEntry(args: { space: SpaceId; entryId: string; fields: Record<string, unknown> }) {
    const { space, entryId, fields } = args;
    try {
      const data = await fetchJson(`${baseFor(space)}/entries/${encodeURIComponent(entryId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
      const item = data?.item;
      const contentTypeId = item?.sys?.contentType?.sys?.id ? String(item.sys.contentType.sys.id) : null;
      logCMAOperation({ action: 'UPDATE', contentType: contentTypeId, entryId, payload: { fields }, response: { sys: item?.sys } });
      toastIfClient('success', 'Saved');
      return item;
    } catch (error) {
      logCMAOperation({ action: 'UPDATE', contentType: null, entryId, payload: { fields }, error });
      toastIfClient('error', error instanceof Error ? error.message : 'Failed to save');
      throw error;
    }
  },

  async deleteEntry(args: { space: SpaceId; entryId: string }) {
    const { space, entryId } = args;
    try {
      const data = await fetchJson(`${baseFor(space)}/entries/${encodeURIComponent(entryId)}`, { method: 'DELETE' });
      logCMAOperation({ action: 'DELETE', contentType: null, entryId, response: data });
      toastIfClient('success', 'Deleted');
      return data;
    } catch (error) {
      logCMAOperation({ action: 'DELETE', contentType: null, entryId, error });
      toastIfClient('error', error instanceof Error ? error.message : 'Failed to delete');
      throw error;
    }
  },

  async getAssetPreviews(args: { space: SpaceId; assetIds: string[] }) {
    const { space, assetIds } = args;
    const ids = assetIds.map((s) => s.trim()).filter(Boolean).slice(0, 100);
    if (ids.length === 0) return [] as Array<{ assetId: string; url: string | null; title: string | null }>;
    const data = await fetchJson(`${baseFor(space)}/assets?ids=${encodeURIComponent(ids.join(','))}`);
    return (data?.items ?? []) as Array<{ assetId: string; url: string | null; title: string | null }>;
  },

  async getImageAssetPreviews(args: { space: SpaceId; entryIds: string[] }) {
    const { space, entryIds } = args;
    const ids = entryIds.map((s) => s.trim()).filter(Boolean).slice(0, 100);
    if (ids.length === 0)
      return [] as Array<{
        entryId: string;
        url: string | null;
        title: string | null;
        assetId: string | null;
        width: number | null;
        height: number | null;
        extension: string | null;
        mimeType: string | null;
      }>;
    const data = await fetchJson(`${baseFor(space)}/image-assets?ids=${encodeURIComponent(ids.join(','))}`);
    return (data?.items ?? []) as Array<{
      entryId: string;
      url: string | null;
      title: string | null;
      assetId: string | null;
      width: number | null;
      height: number | null;
      extension: string | null;
      mimeType: string | null;
    }>;
  },

  async ensureArtModelLoaded(model: 'project' | 'category' | 'navigationGroup' | 'tech', options?: { force?: boolean }) {
    const store = useContentfulStore.getState();
    const force = Boolean(options?.force);
    if (!force && store.loadedModels[model]) return;
    const items = await this.listEntries({ space: 'art', contentTypeId: model, limit: 1000 });
    if (model === 'project') store.setProjects(items as any);
    else if (model === 'category') store.setCategories(items as any);
    else if (model === 'navigationGroup') store.setNavigationGroups(items as any);
    else store.setTechs(items as any);
  },

  async ensureHubModelLoaded(
    model: 'contact' | 'socialNetwork' | 'experience' | 'course' | 'study' | 'language' | 'tech' | 'resume',
    options?: { force?: boolean },
  ) {
    const store = useHubStore.getState();
    const force = Boolean(options?.force);
    if (!force && store.loaded[model]) return;
    const items = await this.listEntries({ space: 'hub', contentTypeId: model, limit: model === 'resume' ? 5 : 1000 });
    store.setModel(model as any, items as any);
  },

  /** Quick store presence check used by some generic components. */
  hasCached(args: { space: SpaceId; contentTypeId: string }): boolean {
    const { space, contentTypeId } = args;
    if (space === 'design') return false;
    if (space === 'art') {
      const s = useContentfulStore.getState();
      if (contentTypeId === 'project') return s.loadedModels.project && recordSize(s.projects) > 0;
      if (contentTypeId === 'category') return s.loadedModels.category && recordSize(s.categories) > 0;
      if (contentTypeId === 'navigationGroup') return s.loadedModels.navigationGroup && recordSize(s.navigationGroups) > 0;
      if (contentTypeId === 'tech') return s.loadedModels.tech && recordSize(s.techs) > 0;
      return false;
    }
    const s = useHubStore.getState();
    if (contentTypeId === 'contact') return s.loaded.contact && recordSize(s.contacts) > 0;
    if (contentTypeId === 'experience') return s.loaded.experience && recordSize(s.experiences) > 0;
    if (contentTypeId === 'course') return s.loaded.course && recordSize(s.courses) > 0;
    if (contentTypeId === 'study') return s.loaded.study && recordSize(s.studies) > 0;
    if (contentTypeId === 'language') return s.loaded.language && recordSize(s.languages) > 0;
    if (contentTypeId === 'tech') return s.loaded.tech && recordSize(s.techs) > 0;
    if (contentTypeId === 'resume') return s.loaded.resume && recordSize(s.resumes) > 0;
    return false;
  },
};

