'use client';

import { create } from 'zustand';
import { coerceRichTextDocument } from '@/lib/contentful/coerceRichTextDocument';
import { emptyContentfulDocument } from '@/lib/contentful/contentfulTiptapBridge';
import { htmlStringToContentfulDocument } from '@/lib/contentful/htmlToContentfulRichText';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [k: string]: JsonValue };

type State = {
  originalData: Record<string, JsonValue> | null;
  currentData: Record<string, JsonValue> | null;
  isDirty: boolean;
};

type Actions = {
  reset: (original: Record<string, JsonValue>) => void;
  setField: (id: string, value: JsonValue) => void;
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

/** Compare Rich Text as Contentful JSON so session HTML matches reloaded Document after undo. */
function canonicalMakingOfSnapshot(value: JsonValue | undefined): string {
  if (value === undefined || value === null) {
    return stableStringify(emptyContentfulDocument());
  }
  if (typeof value === 'string') {
    try {
      return stableStringify(htmlStringToContentfulDocument(value));
    } catch {
      return stableStringify(value);
    }
  }
  const doc = coerceRichTextDocument(value as unknown);
  if (doc) return stableStringify(doc);
  return stableStringify(value);
}

function computeDirty(
  original: Record<string, JsonValue> | null,
  next: Record<string, JsonValue>,
): boolean {
  if (!original) return Object.keys(next).length > 0;
  const keys = new Set([...Object.keys(original), ...Object.keys(next)]);
  for (const key of keys) {
    if (key === 'makingOf') {
      if (canonicalMakingOfSnapshot(original[key]) !== canonicalMakingOfSnapshot(next[key])) {
        return true;
      }
      continue;
    }
    if (stableStringify(original[key]) !== stableStringify(next[key])) {
      return true;
    }
  }
  return false;
}

export const useProjectEditorStore = create<State & Actions>((set) => ({
  originalData: null,
  currentData: null,
  isDirty: false,

  reset: (original) =>
    set(() => ({
      originalData: original,
      currentData: original,
      isDirty: false,
    })),

  setField: (id, value) =>
    set((state) => {
      const next = { ...(state.currentData ?? {}), [id]: value } as Record<string, JsonValue>;
      const isDirty = computeDirty(state.originalData, next);
      return { currentData: next, isDirty };
    }),
}));

