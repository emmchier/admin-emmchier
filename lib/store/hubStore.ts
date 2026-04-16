import { create } from 'zustand';

// HUB entries use Contentful CMA/CDA shapes; keep them unopinionated here.
export type HubEntryLike = { sys: { id: string; [k: string]: any }; fields?: Record<string, any> };
export type HubContactEntry = HubEntryLike;
export type HubSocialNetworkEntry = HubEntryLike;
export type HubExperienceEntry = HubEntryLike;
export type HubCourseEntry = HubEntryLike;
export type HubStudyEntry = HubEntryLike;
export type HubLanguageEntry = HubEntryLike;
export type HubTechEntry = HubEntryLike;
export type HubResumeEntry = HubEntryLike;

export type HubModelName = 'contact' | 'socialNetwork' | 'experience' | 'course' | 'study' | 'language' | 'tech' | 'resume';

export type HubLoadedModels = Record<HubModelName, boolean>;

export type HubStoreState = {
  contacts: Record<string, HubContactEntry>;
  socialNetworks: Record<string, HubSocialNetworkEntry>;
  experiences: Record<string, HubExperienceEntry>;
  courses: Record<string, HubCourseEntry>;
  studies: Record<string, HubStudyEntry>;
  languages: Record<string, HubLanguageEntry>;
  techs: Record<string, HubTechEntry>;
  resumes: Record<string, HubResumeEntry>;
  loaded: HubLoadedModels;
  dirty: Partial<Record<HubModelName, boolean>>;
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
  if (Array.isArray(data)) return toRecordById(data);
  return { ...(data as Record<string, T>) };
}

type HubStoreActions = {
  isLoaded: (model: HubModelName) => boolean;
  markLoaded: (model: HubModelName) => void;
  invalidate: (model: HubModelName) => void;

  setModel: (model: HubModelName, data: Many<any>) => void;
  upsert: (model: HubModelName, entry: any) => void;
  remove: (model: HubModelName, entryId: string) => void;
  updateFields: (model: HubModelName, args: { entryId: string; locale: string; fields: Record<string, any>; sysPatch?: Record<string, any> }) => void;

  getRecord: (model: HubModelName) => Record<string, any>;
};

const initialLoaded: HubLoadedModels = {
  contact: false,
  socialNetwork: false,
  experience: false,
  course: false,
  study: false,
  language: false,
  tech: false,
  resume: false,
};

export type HubStore = HubStoreState & HubStoreActions;

export const useHubStore = create<HubStore>((set, get) => ({
  contacts: {},
  socialNetworks: {},
  experiences: {},
  courses: {},
  studies: {},
  languages: {},
  techs: {},
  resumes: {},
  loaded: { ...initialLoaded },
  dirty: {},

  isLoaded: (model) => get().loaded[model],

  markLoaded: (model) => set((s) => ({ loaded: { ...s.loaded, [model]: true }, dirty: { ...s.dirty, [model]: false } })),

  invalidate: (model) => set((s) => ({ loaded: { ...s.loaded, [model]: false }, dirty: { ...s.dirty, [model]: true } })),

  getRecord: (model) => {
    const s = get();
    switch (model) {
      case 'contact':
        return s.contacts;
      case 'socialNetwork':
        return s.socialNetworks;
      case 'experience':
        return s.experiences;
      case 'course':
        return s.courses;
      case 'study':
        return s.studies;
      case 'language':
        return s.languages;
      case 'tech':
        return s.techs;
      case 'resume':
        return s.resumes;
    }
  },

  setModel: (model, data) =>
    set((s) => {
      const next = normalizeMany(data);
      const loaded = { ...s.loaded, [model]: true };
      const dirty = { ...s.dirty, [model]: false };
      switch (model) {
        case 'contact':
          return { contacts: next, loaded, dirty };
        case 'socialNetwork':
          return { socialNetworks: next, loaded, dirty };
        case 'experience':
          return { experiences: next, loaded, dirty };
        case 'course':
          return { courses: next, loaded, dirty };
        case 'study':
          return { studies: next, loaded, dirty };
        case 'language':
          return { languages: next, loaded, dirty };
        case 'tech':
          return { techs: next, loaded, dirty };
        case 'resume':
          return { resumes: next, loaded, dirty };
      }
    }),

  upsert: (model, entry) =>
    set((s) => {
      const id = entry?.sys?.id as string | undefined;
      if (!id) return s;
      switch (model) {
        case 'contact':
          return { contacts: { ...s.contacts, [id]: entry } };
        case 'socialNetwork':
          return { socialNetworks: { ...s.socialNetworks, [id]: entry } };
        case 'experience':
          return { experiences: { ...s.experiences, [id]: entry } };
        case 'course':
          return { courses: { ...s.courses, [id]: entry } };
        case 'study':
          return { studies: { ...s.studies, [id]: entry } };
        case 'language':
          return { languages: { ...s.languages, [id]: entry } };
        case 'tech':
          return { techs: { ...s.techs, [id]: entry } };
        case 'resume':
          return { resumes: { ...s.resumes, [id]: entry } };
      }
    }),

  remove: (model, entryId) =>
    set((s) => {
      const del = <T extends Record<string, any>>(rec: T) => {
        if (!rec[entryId]) return rec;
        const next = { ...rec };
        delete (next as any)[entryId];
        return next;
      };
      switch (model) {
        case 'contact':
          return { contacts: del(s.contacts) };
        case 'socialNetwork':
          return { socialNetworks: del(s.socialNetworks) };
        case 'experience':
          return { experiences: del(s.experiences) };
        case 'course':
          return { courses: del(s.courses) };
        case 'study':
          return { studies: del(s.studies) };
        case 'language':
          return { languages: del(s.languages) };
        case 'tech':
          return { techs: del(s.techs) };
        case 'resume':
          return { resumes: del(s.resumes) };
      }
    }),

  updateFields: (model, args) =>
    set((s) => {
      const { entryId, locale, fields, sysPatch } = args;
      const apply = (entry: any) => {
        if (!entry) return entry;
        const mergedFields = { ...(entry.fields ?? {}) } as Record<string, any>;
        for (const [k, v] of Object.entries(fields)) {
          const prev = mergedFields[k];
          if (prev && typeof prev === 'object' && !Array.isArray(prev) && prev.sys == null) {
            mergedFields[k] = { ...prev, [locale]: v };
          } else {
            mergedFields[k] = { [locale]: v };
          }
        }
        const now = new Date().toISOString();
        const sys = { ...(entry.sys ?? {}) } as Record<string, any>;
        sys.updatedAt = now;
        if (sysPatch) {
          for (const [k, v] of Object.entries(sysPatch)) {
            if (v === undefined) delete sys[k];
            else sys[k] = v;
          }
        }
        return { ...entry, sys, fields: mergedFields };
      };

      switch (model) {
        case 'contact': {
          const existing = s.contacts[entryId];
          if (!existing) return s;
          return { contacts: { ...s.contacts, [entryId]: apply(existing) } };
        }
        case 'socialNetwork': {
          const existing = s.socialNetworks[entryId];
          if (!existing) return s;
          return { socialNetworks: { ...s.socialNetworks, [entryId]: apply(existing) } };
        }
        case 'experience': {
          const existing = s.experiences[entryId];
          if (!existing) return s;
          return { experiences: { ...s.experiences, [entryId]: apply(existing) } };
        }
        case 'course': {
          const existing = s.courses[entryId];
          if (!existing) return s;
          return { courses: { ...s.courses, [entryId]: apply(existing) } };
        }
        case 'study': {
          const existing = s.studies[entryId];
          if (!existing) return s;
          return { studies: { ...s.studies, [entryId]: apply(existing) } };
        }
        case 'language': {
          const existing = s.languages[entryId];
          if (!existing) return s;
          return { languages: { ...s.languages, [entryId]: apply(existing) } };
        }
        case 'tech': {
          const existing = s.techs[entryId];
          if (!existing) return s;
          return { techs: { ...s.techs, [entryId]: apply(existing) } };
        }
        case 'resume': {
          const existing = s.resumes[entryId];
          if (!existing) return s;
          return { resumes: { ...s.resumes, [entryId]: apply(existing) } };
        }
      }
    }),
}));

