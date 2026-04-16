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
import { ProjectGalleryUploader, type ProjectGalleryUploaderHandle } from '@/components/cms/ProjectGalleryUploader';
import { EntryReferenceMultiSelect } from '@/components/cms/EntryReferenceMultiSelect';
import { EntryReferenceMultiTypeSelect } from '@/components/cms/EntryReferenceMultiTypeSelect';
import { ProjectTechsPicker } from '@/components/cms/ProjectTechsPicker';
import { useProjectEditorStore } from '@/lib/stores/projectEditorStore';
import { RichTextViewer } from '@/components/cms/RichTextViewer';
import { ExternalLink } from 'lucide-react';

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
  const v = field?.items?.validations?.find((x: any) => Array.isArray(x?.linkContentType))?.linkContentType;
  return Array.isArray(v) ? v : [];
}

function readInitial(initialFields: Record<string, any> | undefined, fieldId: string, locale: string) {
  const raw = initialFields?.[fieldId];
  if (raw == null) return undefined;
  // CDA: field may be a resolved scalar (not wrapped per locale).
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
    return raw;
  }
  // CDA: arrays are already resolved (e.g. gallery links, tech links).
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'object') return undefined;
  const o = raw as Record<string, any>;
  // CDA: single link values are objects with `sys`.
  if (o.sys != null && typeof o.sys === 'object') return o;
  // CDA: RichText documents are objects with `nodeType: 'document'`.
  if (o.nodeType === 'document') return o;
  const localized = o[locale] ?? o['en-US'];
  if (localized !== undefined && localized !== null) return localized;
  const vals = Object.values(o);
  return vals.length ? vals[0] : undefined;
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
  } =
    props;
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const setField = useProjectEditorStore((s) => s.setField);
  const markSlugManual = useProjectEditorStore((s) => s.markSlugManual);
  const applySlugFromTitleIfAllowed = useProjectEditorStore((s) => s.applySlugFromTitleIfAllowed);

  const fields = React.useMemo(() => {
    return (contentType.fields || []).filter(isEditableField);
  }, [contentType.fields]);

  const isProject = contentType.sys?.id === 'project';
  const galleryRef = React.useRef<ProjectGalleryUploaderHandle | null>(null);

  const sectionHeading = React.useCallback((f: any, required: boolean) => {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-neutral-900">
        <span>{f.name || f.id}</span>
        <span className="text-neutral-400">|</span>
        <span className="italic text-neutral-500">{String(f.id)}</span>
        {required ? <span className="text-xs font-normal text-neutral-500">(required)</span> : null}
      </div>
    );
  }, []);

  const contentTypeHasSlugField = React.useMemo(() => fields.some((f) => f.id === 'slug'), [fields]);

  const [values, setValues] = React.useState<Record<string, JsonValue>>(() => {
    const v: Record<string, JsonValue> = {};
    for (const f of fields) {
      const init = readInitial(initialFields, f.id, locale);
      if (init !== undefined) v[f.id] = init as JsonValue;
    }
    return v;
  });

  // When the entry changes, sync initial values into the store to track dirty state.
  const lastInitialFpRef = React.useRef<string>('');
  React.useEffect(() => {
    const initial: Record<string, any> = {};
    for (const f of fields) {
      const init = readInitial(initialFields, f.id, locale);
      if (init !== undefined) initial[f.id] = init;
    }
    const fp = JSON.stringify(initial);
    if (fp === lastInitialFpRef.current) return;
    lastInitialFpRef.current = fp;

    // Sync form local state + store baseline when the loaded entry changes.
    setValues(initial as Record<string, JsonValue>);
    useProjectEditorStore.getState().reset(initial as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType.sys?.id, initialFields, locale]);

  const setValue = React.useCallback((id: string, next: JsonValue) => {
    setValues((prev) => ({ ...prev, [id]: next }));
  }, []);

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
    [busy, onSubmit, values],
  );

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-6">
      {!hideHeader ? (
        <>
          <div className="space-y-2">
            <h1 className="text-lg font-semibold text-zinc-900">{contentType.name}</h1>
          </div>
          <Separator />
        </>
      ) : null}

      <div className="space-y-5">
        {isProject ? (
          <div className="flex flex-col gap-4 md:flex-row md:items-stretch">
            <div className="w-full md:w-1/2">
              <div className="grid gap-4">
                {(() => {
                  const f = fields.find((x) => x.id === 'title');
                  if (!f) return null;
                  const v = values[f.id];
                  const required = Boolean(f.required);
                  return (
                    <div className="grid gap-2">
                      <Label htmlFor={f.id}>{sectionHeading(f, required)}</Label>
                      <Input
                        id={f.id}
                        value={typeof v === 'string' ? v : ''}
                        className="w-full"
                        onChange={(e) => {
                          const next = e.target.value;
                          setValue(f.id, next);
                          setField(f.id, next);
                          if (contentTypeHasSlugField) {
                            const st = useProjectEditorStore.getState();
                            if (!st.slugManuallyEdited) {
                              const slug = slugifyTitle(next);
                              setValue('slug', slug);
                              setField('slug', slug);
                            }
                            applySlugFromTitleIfAllowed();
                          }
                        }}
                      />
                    </div>
                  );
                })()}
                {(() => {
                  const f = fields.find((x) => x.id === 'slug');
                  if (!f) return null;
                  const v = values[f.id];
                  const required = Boolean(f.required);
                  return (
                    <div className="grid gap-2">
                      <Label htmlFor={f.id}>{sectionHeading(f, required)}</Label>
                      <Input
                        id={f.id}
                        value={typeof v === 'string' ? v : ''}
                        className="w-full"
                        onChange={(e) => {
                          const next = e.target.value;
                          setValue(f.id, next);
                          setField(f.id, next);
                          markSlugManual();
                        }}
                      />
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
                return (
                  <div className="flex min-h-0 flex-1 flex-col gap-2">
                    <Label htmlFor={f.id}>{sectionHeading(f, required)}</Label>
                    <Textarea
                      id={f.id}
                      value={typeof v === 'string' ? v : ''}
                      onChange={(e) => {
                        const next = e.target.value;
                        setValue(f.id, next);
                        setField(f.id, next);
                      }}
                      onBlur={(e) => setField(f.id, e.target.value)}
                      className="min-h-0 flex-1 resize-none"
                    />
                  </div>
                );
              })()}
            </div>
          </div>
        ) : null}

        {fields.map((f) => {
          if (isProject && (f.id === 'title' || f.id === 'slug' || f.id === 'description')) return null;
          const t = fieldType(f);
          const v = values[f.id];
          const required = Boolean(f.required);

          const label = (
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor={f.id}>{sectionHeading(f, required)}</Label>
            </div>
          );

          if (t === 'Symbol') {
            return (
              <div key={f.id} className="grid gap-2">
                {label}
                <Input
                  id={f.id}
                  value={typeof v === 'string' ? v : ''}
                  onChange={(e) => {
                    const next = e.target.value;
                    setValue(f.id, next);
                    setField(f.id, next);
                    if (contentTypeHasSlugField) {
                      if (f.id === 'slug') markSlugManual();
                      if (f.id === 'title' || f.id === 'name') applySlugFromTitleIfAllowed();
                    }
                  }}
                />
              </div>
            );
          }

          if (t === 'Text') {
            const isDescription = f.id === 'description';
            return (
              <div key={f.id} className="grid gap-2">
                {label}
                <Textarea
                  id={f.id}
                  value={typeof v === 'string' ? v : ''}
                  onChange={(e) => {
                    const next = e.target.value;
                    setValue(f.id, next);
                  }}
                  onBlur={(e) => {
                    const next = e.target.value;
                    setField(f.id, next);
                  }}
                  rows={isDescription ? 8 : 4}
                  className={isDescription ? 'max-h-50 overflow-y-auto resize-none' : undefined}
                />
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
                  onChange={(e) => setValue(f.id, e.target.value === '' ? null : Number(e.target.value))}
                  onBlur={() => setField(f.id, typeof v === 'number' ? v : null)}
                />
              </div>
            );
          }

          if (t === 'Boolean') {
            return (
              <div key={f.id} className="flex items-center justify-between gap-3 border border-neutral-200 px-4 py-4">
                <div className="grid gap-0.5">
                  <Label htmlFor={f.id} className="text-sm">
                    {f.name || f.id} <span className="text-xs text-zinc-500">({f.id})</span>
                  </Label>
                  <p className="text-xs text-zinc-500">{required ? 'required' : 'optional'}</p>
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
                        .filter(Boolean),
                    )
                  }
                  onBlur={() => setField(f.id, Array.isArray(v) ? v : [])}
                  rows={4}
                />
                <p className="text-xs text-zinc-500">One item per line.</p>
              </div>
            );
          }

          if (t === 'Array' && f.items?.type === 'Link' && f.items?.linkType === 'Entry') {
            const links = Array.isArray(v) ? v : [];
            if (f.id === 'gallery') {
              return (
                <div key={f.id} className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    {sectionHeading({ ...f, name: 'Gallery' }, required)}
                    <Button type="button" variant="outline" size="sm" onClick={() => galleryRef.current?.open?.()}>
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
                    projectSlug={typeof values.slug === 'string' ? values.slug : undefined}
                  />
                </div>
              );
            }

            if (contentType.sys?.id === 'project' && f.id === 'techs') {
              return (
                <div key={f.id} className="grid gap-2">
                  {label}
                  <ProjectTechsPicker
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

          if (f.id === 'makingOf' && t === 'RichText') {
            const spaceId = contentfulSpaceId ?? null;
            const canOpen = Boolean(spaceId && entryId);
            const href =
              spaceId && entryId
                ? `https://app.contentful.com/spaces/${encodeURIComponent(spaceId)}/entries/${encodeURIComponent(entryId)}`
                : '#';

            return (
              <div key={f.id} className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  {label}
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-disabled={!canOpen}
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    onClick={(e) => {
                      if (!canOpen) e.preventDefault();
                    }}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Editar en Contentful
                  </a>
                </div>
                <div className="border border-neutral-200 p-4">
                  <RichTextViewer managementApiRoot={managementApiRoot} value={v as any} />
                </div>
              </div>
            );
          }

          // Link/RichText/Object/Array Links: rendered later with dedicated components.
          return (
            <div key={f.id} className="grid gap-2">
              {label}
              <div className="border border-neutral-200 bg-neutral-50/80 p-4 text-sm text-neutral-700">
                Unsupported field type for now: <span className="font-mono">{t}</span>
              </div>
            </div>
          );
        })}
      </div>

      {error ? (
        <p className="border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">{error}</p>
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

