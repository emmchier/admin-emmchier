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
import { ExternalLink, Plus } from 'lucide-react';
import { ArrowUpRight, Copy } from 'lucide-react';
import { readInitialFieldValue } from '@/lib/contentful/readInitialFieldValue';
import { coerceRichTextDocument } from '@/lib/contentful/coerceRichTextDocument';
import { emptyContentfulDocument } from '@/lib/contentful/contentfulTiptapBridge';
import {
  clampEntryFieldString,
  EntryFieldCharacterFooter,
  ENTRY_FIELD_CHAR_LIMIT,
} from '@/components/cms/entryFieldCharacterLimit';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/ui/snackbar';
import { derivePlatformFromUrlInput, stripUrlForDisplay, validateSocialUrl } from '@/lib/url/socialUrl';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

/** Slug is derived from title/name everywhere — never user-editable or focusable. */
const SLUG_INPUT_READONLY_CLASS =
  'cursor-default select-none bg-neutral-100 text-neutral-700 border-neutral-200 pointer-events-none focus-visible:border-neutral-200 focus-visible:ring-0 focus-visible:outline-none dark:bg-neutral-900/40 dark:border-neutral-700 dark:text-neutral-300 dark:focus-visible:border-neutral-700';

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

function orderSocialNetworkFields<T extends { id: string }>(fields: T[]): T[] {
  const blockIds = ['url', 'platform'] as const;
  const byId = new Map(fields.map((f) => [f.id, f]));
  const blockFields = blockIds.map((id) => byId.get(id)).filter((f): f is T => Boolean(f));
  const set = new Set<string>(blockIds);
  const rest = fields.filter((f) => !set.has(f.id));
  return [...blockFields, ...rest];
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

  const fields = React.useMemo(() => {
    return (contentType.fields || []).filter(isEditableField);
  }, [contentType.fields]);

  const fieldsForRender = React.useMemo(() => {
    if (contentType.sys?.id === 'project') return orderProjectFields(fields);
    if (contentType.sys?.id === 'socialNetwork') return orderSocialNetworkFields(fields);
    return fields;
  }, [contentType.sys?.id, fields]);

  const isProject = contentType.sys?.id === 'project';
  const isCategory = contentType.sys?.id === 'category';
  const isNavigationGroup = contentType.sys?.id === 'navigationGroup';
  const isSocialNetwork = contentType.sys?.id === 'socialNetwork';
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
        const next =
          contentType.sys?.id === 'socialNetwork' && f.id === 'url'
            ? stripUrlForDisplay(init)
            : init;
        v[f.id] = clampEntryFieldString(next);
      } else {
        v[f.id] = init as JsonValue;
      }
    }
    if (contentType.sys?.id === 'socialNetwork' && typeof v.url === 'string') {
      v.platform = derivePlatformFromUrlInput(v.url) as any;
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
        const next =
          contentType.sys?.id === 'socialNetwork' && f.id === 'url'
            ? stripUrlForDisplay(init)
            : init;
        initial[f.id] = clampEntryFieldString(next);
      } else {
        initial[f.id] = init;
      }
    }
    if (contentType.sys?.id === 'socialNetwork' && typeof initial.url === 'string') {
      initial.platform = derivePlatformFromUrlInput(initial.url);
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
      className="space-y-8"
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

      <div className="space-y-8">
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
                    <div className="grid w-full min-w-0 gap-2">
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
                            const slugClamped = clampEntryFieldString(
                              slugifyTitle(next),
                            );
                            setValue('slug', slugClamped);
                            setField('slug', slugClamped);
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
                    <div className="grid w-full min-w-0 gap-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label>{sectionHeading(f, required)}</Label>
                      </div>
                      <Input
                        value={slugStr}
                        readOnly
                        tabIndex={-1}
                        aria-readonly="true"
                        title="Generado automáticamente desde el título"
                        className={cn('w-full', SLUG_INPUT_READONLY_CLASS)}
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
          if (isSocialNetwork && f.id === 'username') return null;
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
            const symbolWidthClass =
              f.id === 'title' || f.id === 'slug'
                ? isCategory
                  ? null
                  : isNavigationGroup
                    ? 'w-full min-w-0 md:w-1/2'
                    : 'w-full min-w-0 md:w-3/4'
                : isSocialNetwork && (f.id === 'platform' || f.id === 'url')
                  ? 'w-full min-w-0'
                  : null;
            return (
              <div
                key={f.id}
                className={cn(
                  'grid gap-2',
                  symbolWidthClass,
                )}
              >
                {f.id === 'slug' ? (
                  <div className="flex items-center justify-between gap-3">
                    <Label>{sectionHeading(f, required)}</Label>
                  </div>
                ) : (
                  label
                )}
                {isSocialNetwork && f.id === 'url' ? (
                  <div className="flex w-full items-center gap-2 md:w-1/2">
                    <Input
                      id={f.id}
                      value={symStr}
                      maxLength={ENTRY_FIELD_CHAR_LIMIT}
                      className="w-full"
                      onChange={(e) => {
                        const next = clampEntryFieldString(e.target.value);
                        setValue(f.id, next);
                        setField(f.id, next);
                        const nextPlatform = derivePlatformFromUrlInput(next);
                        setValue('platform', nextPlatform as any);
                        setField('platform', nextPlatform as any);
                      }}
                    />
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="Copy URL"
                            disabled={!validateSocialUrl(symStr).ok}
                            onClick={async () => {
                              const chk = validateSocialUrl(symStr);
                              if (!chk.ok) return;
                              try {
                                await navigator.clipboard.writeText(chk.normalized);
                                toast.success('Copied');
                              } catch {
                                toast.error('Failed to copy');
                              }
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-black text-white">
                          Copy
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="Open URL"
                            disabled={!validateSocialUrl(symStr).ok}
                            onClick={() => {
                              const chk = validateSocialUrl(symStr);
                              if (!chk.ok) return;
                              window.open(chk.normalized, '_blank', 'noopener,noreferrer');
                            }}
                          >
                            <ArrowUpRight className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-black text-white">
                          Open link
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                ) : isSocialNetwork && f.id === 'platform' ? (
                  <Input
                    id={f.id}
                    value={derivePlatformFromUrlInput(typeof values.url === 'string' ? (values.url as string) : '')}
                    disabled
                    className="w-full md:w-1/2"
                  />
                ) : (
                  <Input
                    id={f.id === 'slug' ? undefined : f.id}
                    value={symStr}
                    readOnly={f.id === 'slug'}
                    tabIndex={f.id === 'slug' ? -1 : undefined}
                    aria-readonly={f.id === 'slug' ? 'true' : undefined}
                    title={
                      f.id === 'slug'
                        ? 'Generado automáticamente desde el título o nombre'
                        : undefined
                    }
                    maxLength={ENTRY_FIELD_CHAR_LIMIT}
                    className={cn(
                      isSocialNetwork && (f.id === 'platform' || f.id === 'url')
                        ? 'w-full md:w-1/2'
                        : 'w-full',
                      f.id === 'slug' && SLUG_INPUT_READONLY_CLASS,
                    )}
                    onChange={
                      f.id === 'slug'
                        ? undefined
                        : (e) => {
                            const next = clampEntryFieldString(e.target.value);
                            setValue(f.id, next);
                            setField(f.id, next);
                            if (!contentTypeHasSlugField) return;
                            if (f.id === 'title' || f.id === 'name') {
                              const slugNext = clampEntryFieldString(
                                slugifyTitle(next),
                              );
                              setValue('slug', slugNext);
                              setField('slug', slugNext);
                            }
                          }
                    }
                  />
                )}
                {isSocialNetwork && f.id === 'url' && symStr.trim() && !validateSocialUrl(symStr).ok ? (
                  <p className="text-xs text-red-600">Invalid URL</p>
                ) : null}
                {f.id !== 'slug' && !(isSocialNetwork && (f.id === 'platform' || f.id === 'url')) ? (
                  <EntryFieldCharacterFooter length={symStr.length} />
                ) : null}
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
            const numStr =
              typeof v === 'number' && !Number.isNaN(v) ? String(v) : '';
            return (
              <div key={f.id} className="grid gap-2">
                {label}
                <Input
                  id={f.id}
                  type="number"
                  value={numStr}
                  className="w-60 max-w-full"
                  onChange={(e) => {
                    const raw = e.target.value;
                    const parsed =
                      raw === '' || raw === '-'
                        ? null
                        : Number(raw);
                    const next =
                      parsed === null || Number.isNaN(parsed)
                        ? null
                        : parsed;
                    setValue(f.id, next as unknown as JsonValue);
                    setField(f.id, next as unknown as JsonValue);
                  }}
                />
                <p className="text-xs text-neutral-500">Valor numérico.</p>
              </div>
            );
          }

          if (t === 'Boolean') {
            return (
              <div
                key={f.id}
                className="flex items-center justify-between gap-3 border border-neutral-200 px-4 py-4"
              >
                <Label htmlFor={f.id} className="cursor-pointer">
                  {sectionHeading(f, required)}
                </Label>
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
                    {sectionHeading(
                      { ...f, name: `Gallery(${links.length})` },
                      required,
                    )}
                    <Button
                      type="button"
                      variant="default"
                      size="lg"
                      className="gap-2 bg-zinc-900 text-white hover:bg-zinc-800"
                      onClick={() => galleryRef.current?.open?.()}
                    >
                      <Plus className="h-5 w-5" strokeWidth={2.5} />
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
                    fullWidth={isCategory || isNavigationGroup}
                    halfWidthSearch={isNavigationGroup}
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
                    fullWidth={isCategory || isNavigationGroup}
                    halfWidthSearch={isNavigationGroup}
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
