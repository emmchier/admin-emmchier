'use client';

import * as React from 'react';
import type { ContentTypeProps } from 'contentful-management';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  ProjectGalleryUploader,
  type ProjectGalleryUploaderHandle,
} from '@/components/cms/ProjectGalleryUploader';
import { EntryReferenceMultiSelect } from '@/components/cms/EntryReferenceMultiSelect';
import { EntryReferenceMultiTypeSelect } from '@/components/cms/EntryReferenceMultiTypeSelect';
import { ProjectTechsPicker } from '@/components/cms/ProjectTechsPicker';
import { useProjectEditorStore } from '@/lib/stores/projectEditorStore';
import { RichTextEditor } from '@/components/cms/RichTextEditor';
import { ExternalLink } from 'lucide-react';
import { readInitialFieldValue } from '@/lib/contentful/readInitialFieldValue';
import { coerceRichTextDocument } from '@/lib/contentful/coerceRichTextDocument';
import { emptyContentfulDocument } from '@/lib/contentful/contentfulTiptapBridge';
import { cn } from '@/lib/utils';
import {
  clampEntryFieldString,
  EntryFieldCharacterFooter,
  ENTRY_FIELD_CHAR_LIMIT,
} from '@/components/cms/entryFieldCharacterLimit';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [k: string]: JsonValue };

type Props = {
  contentType: ContentTypeProps;
  locale: string;
  entryId?: string | null;
  contentfulSpaceId?: string | null;
  managementApiRoot?: string;
  initialFields?: Record<string, any>;
  onSubmit: (fields: Record<string, JsonValue>) => Promise<void>;
  submitLabel: string;
  formId?: string;
  hideHeader?: boolean;
  hideSubmit?: boolean;
  onValuesChange?: (values: Record<string, JsonValue>) => void;
  /**
   * Bump after revert (or similar) so local `values` rehydrate from `initialFields` even when
   * their JSON fingerprint matches a previous sync (e.g. entry.fields unchanged on disk while the user edited).
   */
  formHydrationKey?: number;
};

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '');
}

function isEditableField(field: any): boolean {
  // We intentionally do NOT allow editing the Content Model, only entry values.
  // Hide "sys" fields and omit fields we can’t render yet.
  return Boolean(field?.id) && !field.disabled && !field.omitted;
}

function fieldType(field: any): string {
  return String(field.type ?? '');
}

function isArrayOfSymbols(items: any) {
  return items?.type === 'Symbol';
}

function linkContentTypesForEntryArrayField(field: any): string[] {
  const v = field?.items?.validations?.find((x: any) =>
    Array.isArray(x?.linkContentType)
  )?.linkContentType;
  return Array.isArray(v) ? v : [];
}

/** Project editor: Gallery → Techs → Making Of regardless of Contentful field order. */
function orderProjectFields<T extends { id: string }>(fields: T[]): T[] {
  const blockIds = ['gallery', 'techs', 'makingOf'] as const;
  const set = new Set<string>(blockIds);
  const byId = new Map(fields.map((f) => [f.id, f]));
  const blockFields = blockIds.map((id) => byId.get(id)).filter((f): f is T => Boolean(f));
  const rest = fields.filter((f) => !set.has(f.id));
  let insertAt = fields.findIndex((f) => f.id === 'gallery');
  if (insertAt < 0) insertAt = fields.findIndex((f) => f.id === 'techs');
  if (insertAt < 0) insertAt = fields.findIndex((f) => f.id === 'makingOf');
  if (insertAt < 0) {
    return [...rest, ...blockFields];
  }
  let restBefore = 0;
  for (let i = 0; i < insertAt; i++) {
    if (!set.has(fields[i]!.id)) restBefore++;
  }
  return [...rest.slice(0, restBefore), ...blockFields, ...rest.slice(restBefore)];
}

export function SchemaDrivenEntryForm(props: Props) {
  const {
    contentType,
    locale,
    entryId,
    contentfulSpaceId,
    managementApiRoot = '/api/contentful',
    initialFields,
    onSubmit,
    submitLabel,
    formId,
    hideHeader,
    hideSubmit,
    onValuesChange,
    formHydrationKey = 0,
  } = props;
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const setField = useProjectEditorStore((s) => s.setField);
  const formDirty = useProjectEditorStore((s) => s.isDirty);
  const markSlugManual = useProjectEditorStore((s) => s.markSlugManual);
  const applySlugFromTitleIfAllowed = useProjectEditorStore(
    (s) => s.applySlugFromTitleIfAllowed
  );

  const fields = React.useMemo(() => {
    return (contentType.fields || []).filter(isEditableField);
  }, [contentType.fields]);

  const fieldsForRender = React.useMemo(() => {
    if (contentType.sys?.id !== 'project') return fields;
    return orderProjectFields(fields);
  }, [contentType.sys?.id, fields]);

  const isProject = contentType.sys?.id === 'project';
  const galleryRef = React.useRef<ProjectGalleryUploaderHandle | null>(null);

  const sectionHeading = React.useCallback((f: any, required: boolean) => {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-neutral-900">
        <span>{f.name || f.id}</span>
        <span className="text-neutral-400">|</span>
        <span className="italic text-neutral-500">{String(f.id)}</span>
        {required ? (
          <span className="text-xs font-normal text-neutral-500">
            (required)
          </span>
        ) : null}
      </div>
    );
  }, []);

  const contentTypeHasSlugField = React.useMemo(
    () => fields.some((f) => f.id === 'slug'),
    [fields]
  );

  const [values, setValues] = React.useState<Record<string, JsonValue>>(() => {
    const v: Record<string, JsonValue> = {};
    for (const f of fields) {
      const init = readInitialFieldValue(initialFields, f.id, locale);
      if (init === undefined) continue;
      const t = fieldType(f);
      if ((t === 'Symbol' || t === 'Text') && typeof init === 'string') {
        v[f.id] = clampEntryFieldString(init);
      } else {
        v[f.id] = init as JsonValue;
      }
    }
    return v;
  });

  // When the entry changes, sync initial values into the store to track dirty state.
  const lastInitialFpRef = React.useRef<string>('');
  React.useEffect(() => {
    const initial: Record<string, any> = {};
    for (const f of fields) {
      const init = readInitialFieldValue(initialFields, f.id, locale);
      if (init === undefined) continue;
      const t = fieldType(f);
      if ((t === 'Symbol' || t === 'Text') && typeof init === 'string') {
        initial[f.id] = clampEntryFieldString(init);
      } else {
        initial[f.id] = init;
      }
    }
    const fp = `${formHydrationKey}:${JSON.stringify(initial)}`;
    if (fp === lastInitialFpRef.current) return;
    lastInitialFpRef.current = fp;

    // Sync form local state + store baseline when the loaded entry changes.
    setValues(initial as Record<string, JsonValue>);
    useProjectEditorStore.getState().reset(initial as any);
  }, [contentType.sys?.id, fields, initialFields, locale, formHydrationKey]);

  const setValue = React.useCallback((id: string, next: JsonValue) => {
    setValues((prev) => ({ ...prev, [id]: next }));
  }, []);

  const emptyRtSignature = React.useMemo(
    () => JSON.stringify(emptyContentfulDocument()),
    [],
  );

  /** Repair Rich Text local state when it stayed empty but CMA fields have content (stale TipTap onChange wipe). */
  React.useLayoutEffect(() => {
    if (formDirty) return;
    for (const f of fields) {
      if (fieldType(f) !== 'RichText') continue;
      const fromInitial = readInitialFieldValue(initialFields, f.id, locale);
      const ci = coerceRichTextDocument(fromInitial as unknown);
      if (!ci || JSON.stringify(ci) === emptyRtSignature) continue;
      const raw = values[f.id];
      const asPayload = ci as unknown as JsonValue;
      if (raw === undefined || raw === null) {
        setValue(f.id, asPayload);
        setField(f.id, asPayload);
        continue;
      }
      if (typeof raw === 'string') {
        const t = raw.trim();
        const looksEmpty =
          t === '' || t === '<p></p>' || /^<p>\s*<\/p>$/i.test(t);
        if (!looksEmpty) continue;
        setValue(f.id, asPayload);
        setField(f.id, asPayload);
        continue;
      }
      const cv = coerceRichTextDocument(raw as unknown);
      if (cv && JSON.stringify(cv) === emptyRtSignature) {
        setValue(f.id, asPayload);
        setField(f.id, asPayload);
      }
    }
  }, [
    formDirty,
    fields,
    initialFields,
    locale,
    values,
    setValue,
    setField,
    emptyRtSignature,
  ]);

  React.useEffect(() => {
    onValuesChange?.(values);
  }, [onValuesChange, values]);

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        await onSubmit(values);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save');
      } finally {
        setBusy(false);
      }
    },
    [busy, onSubmit, values]
  );

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      className={cn(isProject ? 'space-y-8' : 'space-y-6')}
    >
      {!hideHeader ? (
        <>
          <div className="space-y-2">
            <h1 className="text-lg font-semibold text-zinc-900">
              {contentType.name}
            </h1>
          </div>
          <Separator />
        </>
      ) : null}

      <div className={cn(isProject ? 'space-y-8' : 'space-y-5')}>
        {isProject ? (
          <div className="flex flex-col gap-8 md:flex-row md:items-stretch">
            <div className="w-full md:w-1/2">
              <div className="grid gap-8">
                {(() => {
                  const f = fields.find((x) => x.id === 'title');
                  if (!f) return null;
                  const v = values[f.id];
                  const required = Boolean(f.required);
                  const str = typeof v === 'string' ? v : '';
                  return (
                    <div className="grid gap-2">
                      <Label htmlFor={f.id}>
                        {sectionHeading(f, required)}
                      </Label>
                      <Input
                        id={f.id}
                        value={str}
                        maxLength={ENTRY_FIELD_CHAR_LIMIT}
                        className="w-full"
                        onChange={(e) => {
                          const next = clampEntryFieldString(e.target.value);
                          setValue(f.id, next);
                          setField(f.id, next);
                          if (contentTypeHasSlugField) {
                            const st = useProjectEditorStore.getState();
                            if (!st.slugManuallyEdited) {
                              const slug = slugifyTitle(next);
                              const slugClamped = clampEntryFieldString(slug);
                              setValue('slug', slugClamped);
                              setField('slug', slugClamped);
                            }
                            applySlugFromTitleIfAllowed();
                          }
                        }}
                      />
                      <EntryFieldCharacterFooter length={str.length} />
                    </div>
                  );
                })()}
                {(() => {
                  const f = fields.find((x) => x.id === 'slug');
                  if (!f) return null;
                  const v = values[f.id];
                  const required = Boolean(f.required);
                  const slugStr = typeof v === 'string' ? v : '';
                  return (
                    <div className="grid gap-2">
                      <Label htmlFor={f.id}>
                        {sectionHeading(f, required)}
                      </Label>
                      <Input
                        id={f.id}
                        value={slugStr}
                        maxLength={ENTRY_FIELD_CHAR_LIMIT}
                        className="w-full"
                        onChange={(e) => {
                          const next = clampEntryFieldString(e.target.value);
                          setValue(f.id, next);
                          setField(f.id, next);
                          markSlugManual();
                        }}
                      />
                      <EntryFieldCharacterFooter length={slugStr.length} />
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="flex min-h-0 w-full flex-1 flex-col">
              {(() => {
                const f = fields.find((x) => x.id === 'description');
                if (!f) return null;
                const v = values[f.id];
                const required = Boolean(f.required);
                const descStr = typeof v === 'string' ? v : '';
                return (
                  <div className="flex min-h-0 flex-1 flex-col gap-2">
                    <Label htmlFor={f.id}>{sectionHeading(f, required)}</Label>
                    <Textarea
                      id={f.id}
                      value={descStr}
                      maxLength={ENTRY_FIELD_CHAR_LIMIT}
                      onChange={(e) => {
                        const next = clampEntryFieldString(e.target.value);
                        setValue(f.id, next);
                        setField(f.id, next);
                      }}
                      onBlur={(e) => setField(f.id, e.target.value)}
                      className="min-h-0 flex-1 resize-none"
                    />
                    <EntryFieldCharacterFooter length={descStr.length} />
                  </div>
                );
              })()}
            </div>
          </div>
        ) : null}

        {fieldsForRender.map((f) => {
          if (
            isProject &&
            (f.id === 'title' || f.id === 'slug' || f.id === 'description')
          )
            return null;
          const t = fieldType(f);
          const v = values[f.id];
          const required = Boolean(f.required);

          const label = (
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor={f.id}>{sectionHeading(f, required)}</Label>
            </div>
          );

          if (t === 'Symbol') {
            const symStr = typeof v === 'string' ? v : '';
            return (
              <div key={f.id} className="grid gap-2">
                {label}
                <Input
                  id={f.id}
                  value={symStr}
                  maxLength={ENTRY_FIELD_CHAR_LIMIT}
                  onChange={(e) => {
                    const next = clampEntryFieldString(e.target.value);
                    setValue(f.id, next);
                    setField(f.id, next);
                    if (contentTypeHasSlugField) {
                      if (f.id === 'slug') markSlugManual();
                      if (f.id === 'title' || f.id === 'name')
                        applySlugFromTitleIfAllowed();
                    }
                  }}
                />
                <EntryFieldCharacterFooter length={symStr.length} />
              </div>
            );
          }

          if (t === 'Text') {
            const isDescription = f.id === 'description';
            const textStr = typeof v === 'string' ? v : '';
            return (
              <div key={f.id} className="grid gap-2">
                {label}
                <Textarea
                  id={f.id}
                  value={textStr}
                  maxLength={ENTRY_FIELD_CHAR_LIMIT}
                  onChange={(e) => {
                    const next = clampEntryFieldString(e.target.value);
                    setValue(f.id, next);
                  }}
                  onBlur={(e) => {
                    const next = clampEntryFieldString(e.target.value);
                    setField(f.id, next);
                  }}
                  rows={isDescription ? 8 : 4}
                  className={isDescription ? 'min-h-48 resize-y' : undefined}
                />
                <EntryFieldCharacterFooter length={textStr.length} />
              </div>
            );
          }

          if (t === 'Integer' || t === 'Number') {
            return (
              <div key={f.id} className="grid gap-2">
                {label}
                <Input
                  id={f.id}
                  type="number"
                  value={typeof v === 'number' ? String(v) : ''}
                  onChange={(e) =>
                    setValue(
                      f.id,
                      e.target.value === '' ? null : Number(e.target.value)
                    )
                  }
                  onBlur={() =>
                    setField(f.id, typeof v === 'number' ? v : null)
                  }
                />
              </div>
            );
          }

          if (t === 'Boolean') {
            return (
              <div
                key={f.id}
                className="flex items-center justify-between gap-3 border border-neutral-200 px-4 py-4"
              >
                <div className="grid gap-0.5">
                  <Label htmlFor={f.id} className="text-sm">
                    {f.name || f.id}{' '}
                    <span className="text-xs text-zinc-500">({f.id})</span>
                  </Label>
                  <p className="text-xs text-zinc-500">
                    {required ? 'required' : 'optional'}
                  </p>
                </div>
                <Switch
                  id={f.id}
                  checked={Boolean(v)}
                  onCheckedChange={(checked) => {
                    setValue(f.id, checked);
                    setField(f.id, checked);
                  }}
                />
              </div>
            );
          }

          if (t === 'Array' && isArrayOfSymbols(f.items)) {
            const arr = Array.isArray(v) ? v : [];
            return (
              <div key={f.id} className="grid gap-2">
                {label}
                <Textarea
                  id={f.id}
                  value={arr.join('\n')}
                  onChange={(e) =>
                    setValue(
                      f.id,
                      e.target.value
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean)
                    )
                  }
                  onBlur={() => setField(f.id, Array.isArray(v) ? v : [])}
                  rows={4}
                />
                <p className="text-xs text-zinc-500">One item per line.</p>
              </div>
            );
          }

          if (
            t === 'Array' &&
            f.items?.type === 'Link' &&
            f.items?.linkType === 'Entry'
          ) {
            const links = Array.isArray(v) ? v : [];
            if (f.id === 'gallery') {
              return (
                <div key={f.id} className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    {sectionHeading({ ...f, name: 'Gallery' }, required)}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => galleryRef.current?.open?.()}
                    >
                      Add images
                    </Button>
                  </div>
                  <ProjectGalleryUploader
                    ref={galleryRef}
                    value={links as any}
                    onChange={(next) => {
                      setValue(f.id, next as any);
                      setField(f.id, next as any);
                    }}
                    managementApiRoot={managementApiRoot}
                    projectSlug={
                      typeof values.slug === 'string' ? values.slug : undefined
                    }
                  />
                </div>
              );
            }

            if (contentType.sys?.id === 'project' && f.id === 'techs') {
              return (
                <div key={f.id}>
                  <ProjectTechsPicker
                    heading={sectionHeading(f, required)}
                    value={links as any}
                    onChange={(next) => {
                      setValue(f.id, next as any);
                      setField(f.id, next as any);
                    }}
                    managementApiRoot={managementApiRoot}
                    entryLocale={locale}
                  />
                </div>
              );
            }

            const linkTypes = linkContentTypesForEntryArrayField(f);
            if (linkTypes.length === 1) {
              return (
                <div key={f.id} className="grid gap-2">
                  {label}
                  <EntryReferenceMultiSelect
                    value={links as any}
                    onChange={(next) => {
                      setValue(f.id, next as any);
                      setField(f.id, next as any);
                    }}
                    managementApiRoot={managementApiRoot}
                    sourceContentTypeId={linkTypes[0]!}
                    entryLocale={locale}
                  />
                </div>
              );
            }
            if (linkTypes.length > 1) {
              return (
                <div key={f.id} className="grid gap-2">
                  {label}
                  <EntryReferenceMultiTypeSelect
                    value={links as any}
                    onChange={(next) => {
                      setValue(f.id, next as any);
                      setField(f.id, next as any);
                    }}
                    managementApiRoot={managementApiRoot}
                    sourceContentTypeIds={linkTypes}
                    entryLocale={locale}
                  />
                </div>
              );
            }
          }

          if (t === 'RichText') {
            const spaceId = contentfulSpaceId ?? null;
            const canOpen = Boolean(spaceId && entryId);
            const href =
              spaceId && entryId
                ? `https://app.contentful.com/spaces/${encodeURIComponent(spaceId)}/entries/${encodeURIComponent(entryId)}`
                : '#';

            const fromInitial = readInitialFieldValue(initialFields, f.id, locale);
            const ci = coerceRichTextDocument(fromInitial as unknown);
            const cv =
              typeof v === 'string' ? null : coerceRichTextDocument(v as unknown);
            const emptySig = JSON.stringify(emptyContentfulDocument());
            let richInput: React.ComponentProps<typeof RichTextEditor>['value'];
            if (typeof v === 'string') {
              richInput = v;
            } else {
              let richDoc = cv ?? ci;
              if (
                !formDirty &&
                cv != null &&
                ci != null &&
                JSON.stringify(cv) === emptySig &&
                JSON.stringify(ci) !== emptySig
              ) {
                richDoc = ci;
              }
              richInput = richDoc ?? undefined;
            }

            return (
              <div key={f.id} className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  {label}
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-disabled={!canOpen}
                    className={buttonVariants({
                      variant: 'outline',
                      size: 'sm',
                    })}
                    onClick={(e) => {
                      if (!canOpen) e.preventDefault();
                    }}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Editar en Contentful
                  </a>
                </div>
                <RichTextEditor
                  key={`rte-${entryId ?? 'new'}-${f.id}-${formHydrationKey}`}
                  value={richInput}
                  managementApiRoot={managementApiRoot}
                  onChange={(next) => {
                    const payload = next as unknown as JsonValue;
                    setValue(f.id, payload);
                    setField(f.id, payload);
                  }}
                  helperText={
                    f.id === 'makingOf'
                      ? 'Artículo contando el proceso del proyecto.'
                      : undefined
                  }
                />
              </div>
            );
          }

          // Link/RichText/Object/Array Links: rendered later with dedicated components.
          return (
            <div key={f.id} className="grid gap-2">
              {label}
              <div className="border border-neutral-200 bg-neutral-50/80 p-4 text-sm text-neutral-700">
                Unsupported field type for now:{' '}
                <span className="font-mono">{t}</span>
              </div>
            </div>
          );
        })}
      </div>

      {error ? (
        <p className="border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {!hideSubmit ? (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? 'Guardando…' : submitLabel}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
