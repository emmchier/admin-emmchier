import { create } from 'zustand';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [k: string]: JsonValue };

type State = {
  originalData: Record<string, JsonValue> | null;
  currentData: Record<string, JsonValue> | null;
  isDirty: boolean;
  slugManuallyEdited: boolean;
};

type Actions = {
  reset: (original: Record<string, JsonValue>) => void;
  setField: (id: string, value: JsonValue) => void;
  markSlugManual: () => void;
  applySlugFromTitleIfAllowed: () => void;
};

function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const sort = (v: any): any => {
    if (!v || typeof v !== 'object') return v;
    if (seen.has(v)) return v;
    seen.add(v);
    if (Array.isArray(v)) return v.map(sort);
    const out: Record<string, any> = {};
    for (const k of Object.keys(v).sort()) out[k] = sort(v[k]);
    return out;
  };
  return JSON.stringify(sort(value));
}

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '');
}

export const useProjectEditorStore = create<State & Actions>((set, get) => ({
  originalData: null,
  currentData: null,
  isDirty: false,
  slugManuallyEdited: false,

  reset: (original) =>
    set(() => ({
      originalData: original,
      currentData: original,
      isDirty: false,
      slugManuallyEdited: false,
    })),

  setField: (id, value) =>
    set((state) => {
      const next = { ...(state.currentData ?? {}), [id]: value } as Record<string, JsonValue>;
      const isDirty =
        stableStringify(state.originalData ?? {}) !== stableStringify(next);
      return { currentData: next, isDirty };
    }),

  markSlugManual: () => set(() => ({ slugManuallyEdited: true })),

  applySlugFromTitleIfAllowed: () =>
    set((state) => {
      if (state.slugManuallyEdited) return state;
      const current = state.currentData ?? {};
      const title =
        typeof current.title === 'string' && current.title.trim().length > 0
          ? current.title
          : typeof current.name === 'string'
            ? current.name
            : '';
      const slug = slugifyTitle(title);
      const next = { ...current, slug } as Record<string, JsonValue>;
      const isDirty =
        stableStringify(state.originalData ?? {}) !== stableStringify(next);
      return { currentData: next, isDirty };
    }),
}));

