import { create } from 'zustand';
import type { Entry } from '@/types/contentful';

/**
 * Cached entities are full `Entry<…>` (sys + fields). Field shapes are
 * `Project`, `Category`, etc. under `entry.fields`.
 */
/** Full entry as returned by CMA / internal APIs (sys + fields). */
export type ProjectEntry = Entry<'project'>;
export type CategoryEntry = Entry<'category'>;
export type NavigationGroupEntry = Entry<'navigationGroup'>;
export type TechEntry = Entry<'tech'>;

export type ContentfulModelName = 'project' | 'category' | 'navigationGroup' | 'tech';

export type ContentfulLoadedModels = {
  project: boolean;
  category: boolean;
  navigationGroup: boolean;
  tech: boolean;
};

export type ContentfulStoreState = {
  projects: Record<string, ProjectEntry>;
  categories: Record<string, CategoryEntry>;
  navigationGroups: Record<string, NavigationGroupEntry>;
  techs: Record<string, TechEntry>;
  loadedModels: ContentfulLoadedModels;
};

type Many<T extends { sys: { id: string } }> = readonly T[] | Record<string, T>;

function toRecordById<T extends { sys: { id: string } }>(items: readonly T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;
    out[item.sys.id] = item;
  }
  return out;
}

function normalizeMany<T extends { sys: { id: string } }>(data: Many<T>): Record<string, T> {
  if (Array.isArray(data)) {
    return toRecordById(data as readonly T[]);
  }
  return { ...(data as Record<string, T>) };
}

type ContentfulStoreActions = {
  setProjects: (data: Many<ProjectEntry>) => void;
  setCategories: (data: Many<CategoryEntry>) => void;
  setNavigationGroups: (data: Many<NavigationGroupEntry>) => void;
  setTechs: (data: Many<TechEntry>) => void;

  upsertProject: (project: ProjectEntry) => void;
  updateProject: (project: ProjectEntry) => void;
  upsertCategory: (entry: CategoryEntry) => void;
  upsertNavigationGroup: (entry: NavigationGroupEntry) => void;
  upsertTech: (entry: TechEntry) => void;
  remove: (model: ContentfulModelName, entryId: string) => void;

  /** True after the corresponding `set*` has run at least once (including empty payloads). */
  isModelLoaded: (modelName: ContentfulModelName) => boolean;
  getProjectById: (id: string) => ProjectEntry | undefined;
  getCategoryById: (id: string) => CategoryEntry | undefined;
  getNavigationGroupById: (id: string) => NavigationGroupEntry | undefined;
  getTechById: (id: string) => TechEntry | undefined;
};

const initialLoaded: ContentfulLoadedModels = {
  project: false,
  category: false,
  navigationGroup: false,
  tech: false,
};

export type ContentfulStore = ContentfulStoreState & ContentfulStoreActions;

export const useContentfulStore = create<ContentfulStore>((set, get) => ({
  projects: {},
  categories: {},
  navigationGroups: {},
  techs: {},
  loadedModels: { ...initialLoaded },

  setProjects: (data) =>
    set((s) => ({
      projects: normalizeMany(data),
      loadedModels: { ...s.loadedModels, project: true },
    })),

  setCategories: (data) =>
    set((s) => ({
      categories: normalizeMany(data),
      loadedModels: { ...s.loadedModels, category: true },
    })),

  setNavigationGroups: (data) =>
    set((s) => ({
      navigationGroups: normalizeMany(data),
      loadedModels: { ...s.loadedModels, navigationGroup: true },
    })),

  setTechs: (data) =>
    set((s) => ({
      techs: normalizeMany(data),
      loadedModels: { ...s.loadedModels, tech: true },
    })),

  upsertProject: (project) =>
    set((s) => ({
      projects: { ...s.projects, [project.sys.id]: project },
    })),

  /** Replaces only if the id already exists (no insert). */
  updateProject: (project) => {
    const id = project.sys.id;
    if (!get().projects[id]) return;
    set((s) => ({
      projects: { ...s.projects, [id]: project },
    }));
  },

  upsertCategory: (entry) =>
    set((s) => ({
      categories: { ...s.categories, [entry.sys.id]: entry },
    })),

  upsertNavigationGroup: (entry) =>
    set((s) => ({
      navigationGroups: { ...s.navigationGroups, [entry.sys.id]: entry },
    })),

  upsertTech: (entry) =>
    set((s) => ({
      techs: { ...s.techs, [entry.sys.id]: entry },
    })),

  remove: (model, entryId) =>
    set((s) => {
      const del = <T extends Record<string, any>>(rec: T) => {
        if (!rec[entryId]) return rec;
        const next = { ...rec };
        delete (next as any)[entryId];
        return next;
      };
      switch (model) {
        case 'project':
          return { projects: del(s.projects) };
        case 'category':
          return { categories: del(s.categories) };
        case 'navigationGroup':
          return { navigationGroups: del(s.navigationGroups) };
        case 'tech':
          return { techs: del(s.techs) };
      }
    }),

  isModelLoaded: (modelName) => get().loadedModels[modelName],

  getProjectById: (id) => get().projects[id],

  getCategoryById: (id) => get().categories[id],

  getNavigationGroupById: (id) => get().navigationGroups[id],

  getTechById: (id) => get().techs[id],
}));

/** Selector-friendly: read one project without subscribing to the whole map. */
export function selectProjectById(id: string) {
  return (s: ContentfulStore) => s.projects[id];
}

export function selectModelLoaded(model: ContentfulModelName) {
  return (s: ContentfulStore) => s.loadedModels[model];
}
