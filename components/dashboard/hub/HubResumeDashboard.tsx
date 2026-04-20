'use client';

import * as React from 'react';
import type { ArtActions } from '@/components/dashboard/art/ArtDashboard';
import type { EntryEditorLabels } from '@/components/cms/EntryEditor';
import { HubExperienceSideSheet } from '@/components/dashboard/hub/HubExperienceSideSheet';
import { HubCourseSideSheet } from '@/components/dashboard/hub/HubCourseSideSheet';
import { HubStudySideSheet } from '@/components/dashboard/hub/HubStudySideSheet';
import { HubLanguageSideSheet } from '@/components/dashboard/hub/HubLanguageSideSheet';
import { HubCachedEntryList } from '@/components/dashboard/hub/HubCachedEntryList';
import { HubCourseDetail, HubExperienceDetail, HubLanguageDetail, HubStudyDetail } from '@/components/dashboard/hub/HubResumeDetails';
import { Button } from '@/components/ui/button';
import { useHubStore } from '@/lib/store/hubStore';
import { Input } from '@/components/ui/input';
import { Check, Loader2, Pencil, RefreshCw, Save, Undo2, X } from 'lucide-react';
import { getHubAssetPreview } from '@/lib/hub/assetUrlCache';
import { toast } from '@/lib/ui/snackbar';
import { contentfulService } from '@/services/contentfulService';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  pickCanonicalResumeEntry,
  readResumeLinkIdsFromResumeFields,
} from '@/lib/hub/resumeLinkField';

type HubResumeSection = 'experience' | 'course' | 'study' | 'language';

const SECTION_RESUME_LINK_FIELD: Record<HubResumeSection, string> = {
  experience: 'workExperience',
  course: 'courses',
  study: 'studies',
  language: 'languages',
};

type SectionCfg = {
  label: string;
  contentTypeId: string;
  primaryFieldId: string;
  displayTitleFieldId?: string;
  entityPluralLabel: string;
  newLabel: string;
  editorLabels: Partial<EntryEditorLabels>;
};

const HUB_RESUME_SECTIONS: HubResumeSection[] = ['experience', 'course', 'study', 'language'];

const SECTION_CONFIG: Record<HubResumeSection, SectionCfg> = {
  experience: {
    label: 'Work Experiences',
    contentTypeId: 'experience',
    primaryFieldId: 'roleEn',
    displayTitleFieldId: 'roleEn',
    entityPluralLabel: 'Work Experiences',
    newLabel: 'New Experience',
    editorLabels: {
      createSubtitle: 'New Experience',
      createEmptyTitle: 'New Experience',
      editEmptyTitle: 'Experience',
      publishToast: 'Experience published',
      unpublishToast: 'Experience unpublished',
      deleteDialogTitle: 'Delete experience',
      deleteDialogDescription: (t) => `Delete the experience '${t}'?`,
    },
  },
  course: {
    label: 'Courses',
    contentTypeId: 'course',
    primaryFieldId: 'titleEn',
    displayTitleFieldId: 'titleEn',
    entityPluralLabel: 'Courses',
    newLabel: 'New Course',
    editorLabels: {
      createSubtitle: 'New Course',
      createEmptyTitle: 'New Course',
      editEmptyTitle: 'Course',
      publishToast: 'Course published',
      unpublishToast: 'Course unpublished',
      deleteDialogTitle: 'Delete course',
      deleteDialogDescription: (t) => `Delete the course '${t}'?`,
    },
  },
  study: {
    label: 'Studies',
    contentTypeId: 'study',
    primaryFieldId: 'titleEn',
    displayTitleFieldId: 'titleEn',
    entityPluralLabel: 'Studies',
    newLabel: 'New Study',
    editorLabels: {
      createSubtitle: 'New Study',
      createEmptyTitle: 'New Study',
      editEmptyTitle: 'Study',
      publishToast: 'Study published',
      unpublishToast: 'Study unpublished',
      deleteDialogTitle: 'Delete study',
      deleteDialogDescription: (t) => `Delete the study '${t}'?`,
    },
  },
  language: {
    label: 'Languages',
    contentTypeId: 'language',
    primaryFieldId: 'nameEn',
    displayTitleFieldId: 'nameEn',
    entityPluralLabel: 'Languages',
    newLabel: 'New Language',
    editorLabels: {
      createSubtitle: 'New Language',
      createEmptyTitle: 'New Language',
      editEmptyTitle: 'Language',
      publishToast: 'Language published',
      unpublishToast: 'Language unpublished',
      deleteDialogTitle: 'Delete language',
      deleteDialogDescription: (t) => `Delete the language '${t}'?`,
    },
  },
};

const SECTION_MODEL: Record<HubResumeSection, 'experience' | 'course' | 'study' | 'language'> = {
  experience: 'experience',
  course: 'course',
  study: 'study',
  language: 'language',
};

export function HubResumeDashboard(props: {
  entryLocale: string;
  contentfulSpaceId: string;
  actions: ArtActions;
}) {
  const { entryLocale, contentfulSpaceId, actions } = props;

  const [activeSection, setActiveSection] = React.useState<HubResumeSection>('experience');

  const [listVersion, setListVersion] = React.useState(0);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  // Refresh is global (header). No per-section refresh.
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = React.useState(false);
  const [rolesDraft, setRolesDraft] = React.useState<string[]>([]);
  const [rolesBusy, setRolesBusy] = React.useState(false);
  const [roleInput, setRoleInput] = React.useState('');
  const [avatarDraftAssetId, setAvatarDraftAssetId] = React.useState<string | null>(null);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const cfg = SECTION_CONFIG[activeSection];
  const activeModel = SECTION_MODEL[activeSection];

  const openCreate = React.useCallback(() => {
    if (activeSection === 'experience') {
      void contentfulService.getEntriesCached({ space: 'hub', contentTypeId: 'tech' });
    }
    setCreateOpen(true);
  }, [activeSection]);
  const openDetail = React.useCallback((id: string) => setDetailId(id), []);

  const resumeLoaded = useHubStore((s) => s.loaded.resume);
  const resumeRecord = useHubStore((s) => s.resumes);

  const resumeEntry = React.useMemo(() => {
    const list = Object.values(resumeRecord) as any[];
    return pickCanonicalResumeEntry(list);
  }, [resumeRecord]);

  const resumeId = resumeEntry?.sys?.id ? String(resumeEntry.sys.id) : null;

  const sidebarCounts = React.useMemo(() => {
    const safe = (n: number) => Math.max(0, n);
    if (!resumeEntry) {
      return { experience: 0, course: 0, study: 0, language: 0 };
    }
    const f = resumeEntry.fields as Record<string, unknown> | undefined;
    return {
      experience: safe(readResumeLinkIdsFromResumeFields(f, 'workExperience', entryLocale).length),
      course: safe(readResumeLinkIdsFromResumeFields(f, 'courses', entryLocale).length),
      study: safe(readResumeLinkIdsFromResumeFields(f, 'studies', entryLocale).length),
      language: safe(readResumeLinkIdsFromResumeFields(f, 'languages', entryLocale).length),
    };
  }, [entryLocale, resumeEntry]);

  const listRestrictToResumeLinks = React.useMemo(() => {
    if (!resumeLoaded) return undefined as string[] | undefined;
    if (!resumeEntry) return [] as string[];
    return readResumeLinkIdsFromResumeFields(
      resumeEntry.fields as Record<string, unknown>,
      SECTION_RESUME_LINK_FIELD[activeSection],
      entryLocale,
    );
  }, [activeSection, entryLocale, resumeEntry, resumeLoaded]);

  const roles = React.useMemo(() => {
    const f = (resumeEntry?.fields ?? {}) as Record<string, any>;
    const raw = f.roles ?? f.Roles ?? f.role ?? f.Role;
    const v = (raw?.[entryLocale] ?? raw?.['en-US'] ?? raw) as any;
    return Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean) : [];
  }, [entryLocale, resumeEntry]);

  React.useEffect(() => {
    // Hydrate editable roles list from resume entry (cache-first).
    setRolesDraft(roles);
    setRoleInput('');
  }, [resumeId, roles]);

  const profileAssetId = React.useMemo(() => {
    const raw = resumeEntry?.fields?.profileImage;
    const cell = (raw?.[entryLocale] ?? raw?.['en-US'] ?? raw) as any;
    const id = cell?.sys?.id ? String(cell.sys.id) : '';
    return id || null;
  }, [entryLocale, resumeEntry]);

  const ensuredResumeRef = React.useRef(false);
  if (!resumeLoaded && !ensuredResumeRef.current) {
    ensuredResumeRef.current = true;
    void contentfulService.getEntriesCached({ space: 'hub', contentTypeId: 'resume' });
  }

  const lastProfileAssetIdRef = React.useRef<string | null>(null);
  if (profileAssetId !== lastProfileAssetIdRef.current) {
    lastProfileAssetIdRef.current = profileAssetId;
    if (!profileAssetId) {
      setAvatarUrl(null);
    } else {
      void getHubAssetPreview(profileAssetId).then((p) => setAvatarUrl(p.url ?? null));
    }
  }

  React.useEffect(() => {
    setAvatarDraftAssetId(profileAssetId);
  }, [profileAssetId]);

  const onPickAvatar = React.useCallback(
    async (file: File | null) => {
      if (!file) return;
      setAvatarBusy(true);
      try {
        const form = new FormData();
        form.set('file', file);
        form.set('title', 'Profile image');
        form.set('alt', 'Profile image');
        const res = await fetch('/api/upload?space=hub', { method: 'POST', body: form });
        let data: { assetId?: string; error?: string } = {};
        try {
          data = (await res.json()) as typeof data;
        } catch {
          throw new Error(res.ok ? 'Invalid response from upload' : `Upload failed (${res.status})`);
        }
        if (!res.ok) throw new Error(data?.error || `Upload failed (${res.status})`);
        const assetId = String(data?.assetId ?? '');
        if (!assetId) throw new Error('Missing assetId');

        const preview = await getHubAssetPreview(assetId);
        setAvatarUrl(preview.url ?? null);
        setAvatarDraftAssetId(assetId);

        const link = { sys: { type: 'Link' as const, linkType: 'Asset' as const, id: assetId } };

        if (!resumeId) {
          toast.error(
            'La imagen se subió a Contentful, pero hace falta una entrada Resume en el espacio Hub para vincularla al CV.',
          );
          return;
        }

        useHubStore.getState().updateFields('resume', {
          entryId: resumeId,
          locale: entryLocale,
          fields: { profileImage: link },
        });
        await actions.updateEntryAction({ entryId: resumeId, fields: { profileImage: link } });
        await actions.publishEntryAction(resumeId);
        toast.success('Foto de perfil guardada en Contentful');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al actualizar avatar');
      } finally {
        setAvatarBusy(false);
      }
    },
    [actions, entryLocale, resumeId],
  );

  const baselineRef = React.useRef<{ roles: string[]; profileAssetId: string | null } | null>(null);
  React.useEffect(() => {
    baselineRef.current = { roles, profileAssetId };
  }, [resumeId, roles, profileAssetId]);

  const resumeDirty = React.useMemo(() => {
    const base = baselineRef.current;
    if (!base) return false;
    const a = base.roles.map((s) => s.trim()).filter(Boolean);
    const b = rolesDraft.map((s) => s.trim()).filter(Boolean);
    const rolesChanged = JSON.stringify(a) !== JSON.stringify(b);
    const avatarChanged = base.profileAssetId !== avatarDraftAssetId;
    return rolesChanged || avatarChanged;
  }, [rolesDraft, avatarDraftAssetId]);

  const revertResume = React.useCallback(() => {
    const base = baselineRef.current;
    if (!base) return;
    setRolesDraft(base.roles);
    setRoleInput('');
    setAvatarDraftAssetId(base.profileAssetId);
    if (base.profileAssetId) {
      void getHubAssetPreview(base.profileAssetId).then((p) => setAvatarUrl(p.url ?? null));
    } else {
      setAvatarUrl(null);
    }
  }, []);

  const saveResume = React.useCallback(async () => {
    if (!resumeId) return;
    if (!resumeDirty) return;
    if (rolesBusy) return;
    setRolesBusy(true);
    try {
      const nextRoles = rolesDraft.map((s) => s.trim()).filter(Boolean).slice(0, 3);
      const link = avatarDraftAssetId
        ? { sys: { type: 'Link', linkType: 'Asset', id: avatarDraftAssetId } }
        : null;
      const fields: Record<string, any> = { roles: nextRoles, profileImage: link };
      useHubStore.getState().updateFields('resume', { entryId: resumeId, locale: entryLocale, fields });
      await actions.updateEntryAction({ entryId: resumeId, fields });
      await actions.publishEntryAction(resumeId);
      toast.success('Saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setRolesBusy(false);
    }
  }, [actions, avatarDraftAssetId, entryLocale, resumeDirty, resumeId, rolesBusy, rolesDraft]);

  const commitRole = React.useCallback(() => {
    const q = roleInput.trim();
    if (!q) return;
    setRolesDraft((prev) => {
      const next = [...prev.map((s) => s.trim()).filter(Boolean)];
      if (next.length >= 3) return prev;
      if (!next.some((x) => x.toLowerCase() === q.toLowerCase())) next.push(q);
      return next;
    });
    setRoleInput('');
  }, [roleInput]);

  const rolesAtMax = rolesDraft.map((s) => s.trim()).filter(Boolean).length >= 3;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      {detailId ? (
        <div className="grid min-h-0 flex-1 grid-cols-12 overflow-hidden bg-white">
          <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:col-start-3 lg:col-span-8">
            {activeSection === 'experience' ? (
              <HubExperienceDetail
                entryId={detailId}
                entryLocale={entryLocale}
                actions={actions}
                onBack={() => setDetailId(null)}
                onDeleted={() => setListVersion((v) => v + 1)}
              />
            ) : activeSection === 'course' ? (
              <HubCourseDetail
                entryId={detailId}
                entryLocale={entryLocale}
                actions={actions}
                onBack={() => setDetailId(null)}
                onDeleted={() => setListVersion((v) => v + 1)}
              />
            ) : activeSection === 'study' ? (
              <HubStudyDetail
                entryId={detailId}
                entryLocale={entryLocale}
                actions={actions}
                onBack={() => setDetailId(null)}
                onDeleted={() => setListVersion((v) => v + 1)}
              />
            ) : activeSection === 'language' ? (
              <HubLanguageDetail
                entryId={detailId}
                entryLocale={entryLocale}
                actions={actions}
                onBack={() => setDetailId(null)}
                onDeleted={() => setListVersion((v) => v + 1)}
              />
            ) : null}
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {/* 16px from top → avatar; 16px avatar → Roles (mt-4 below profile row) */}
        <div className="shrink-0 pb-0 pt-4">
          <div className="grid grid-cols-12">
            <div className="col-span-12 flex min-h-0 flex-col lg:col-start-3 lg:col-span-8">
              {/* Profile row: avatar + name (center) | Revert / Save — matches reference */}
              <div className="flex flex-wrap items-center justify-between gap-4 px-4 lg:px-0">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-neutral-200 bg-white shadow-none ring-0"
                      aria-label="Open avatar preview"
                      onClick={() => setAvatarPreviewOpen(true)}
                      disabled={!avatarUrl}
                    >
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-linear-to-br from-neutral-100 to-neutral-200" />
                      )}
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        e.target.value = '';
                        void onPickAvatar(f);
                      }}
                    />

                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="absolute -bottom-0.5 -right-0.5 z-10 h-6 w-6 rounded-full border border-neutral-200 bg-white p-0 shadow-sm hover:bg-neutral-50"
                            aria-label="Edit avatar"
                            onClick={(e) => {
                              e.stopPropagation();
                              fileInputRef.current?.click();
                            }}
                            disabled={avatarBusy}
                          >
                            {avatarBusy ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Pencil className="h-3 w-3 text-neutral-700" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="border-0 bg-black text-white">Edit</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-[18px] font-semibold leading-snug text-neutral-900">
                      Emmanuel Chierchie
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-nowrap items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={revertResume}
                    disabled={!resumeDirty || rolesBusy || avatarBusy}
                    className="text-neutral-500 hover:bg-transparent hover:text-neutral-900 disabled:text-neutral-300"
                  >
                    <Undo2 className="mr-2 h-4 w-4" />
                    Revert
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void saveResume()}
                    disabled={!resumeDirty || rolesBusy || avatarBusy || !resumeId}
                    className="rounded-full bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-500"
                  >
                    {rolesBusy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save changes
                  </Button>
                </div>
              </div>

              {/* Roles — 16px below avatar row (mt-4); padding above divider */}
              <div className="mt-4 px-4 pb-0 lg:px-0">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex shrink-0 items-baseline gap-2 text-sm">
                    <span className="font-semibold text-neutral-900">Roles</span>
                    <span className="text-neutral-300">|</span>
                    <span className="italic text-neutral-500">roles</span>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
                    <div className="relative w-full max-w-[240px] shrink-0 sm:w-auto">
                      <Input
                        value={roleInput}
                        onChange={(e) => setRoleInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (!rolesAtMax) commitRole();
                          }
                        }}
                        placeholder="Add role"
                        disabled={rolesAtMax || !resumeId}
                        className={`h-10 rounded-lg border-neutral-200 bg-white md:text-sm ${roleInput.length > 0 ? 'pr-9' : 'pr-3'}`}
                        aria-label="Add role"
                      />
                      {roleInput.length > 0 ? (
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                          aria-label="Clear"
                          onClick={() => setRoleInput('')}
                          disabled={rolesAtMax || !resumeId}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 shrink-0 rounded-lg"
                      aria-label="Add role"
                      disabled={rolesAtMax || !roleInput.trim() || !resumeId}
                      onClick={commitRole}
                    >
                      <Check className="h-4 w-4 text-neutral-500" />
                    </Button>
                    {rolesDraft.map((r, idx) => (
                      <span
                        key={`${r}-${idx}`}
                        className="inline-flex max-w-[min(100%,280px)] items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-900"
                      >
                        <span className="min-w-0 truncate">{r}</span>
                        <button
                          type="button"
                          className="shrink-0 rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
                          aria-label="Remove role"
                          onClick={() => setRolesDraft((prev) => prev.filter((x) => x !== r))}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Spacing → divider → spacing before sections below (matches 16px rhythm) */}
              <div className="mt-4 border-t border-neutral-100" aria-hidden />

              <Dialog open={avatarPreviewOpen} onOpenChange={setAvatarPreviewOpen}>
                <DialogContent className="max-w-3xl p-0">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="h-auto w-full max-h-[80vh] object-contain"
                    />
                  ) : null}
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

      <div className="grid grid-cols-12 pt-4">
        <div className="col-span-12 lg:col-start-3 lg:col-span-8">
          <div className="flex min-h-0 flex-1 gap-6 overflow-hidden px-4 lg:px-0">
            <aside className="flex w-60 shrink-0 flex-col bg-white pb-4 pt-0">
          <nav className="min-h-0 flex-1 overflow-auto" aria-label="Resumé sections">
            <div className="flex flex-col gap-1">
              {HUB_RESUME_SECTIONS.map((s) => {
                const isActive = s === activeSection;
                const label = SECTION_CONFIG[s].label;
                const count =
                  s === 'experience'
                    ? sidebarCounts.experience
                    : s === 'course'
                      ? sidebarCounts.course
                      : s === 'study'
                        ? sidebarCounts.study
                        : sidebarCounts.language;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={isActive}
                    onClick={() => {
                      void contentfulService.getEntriesCached({ space: 'hub', contentTypeId: SECTION_CONFIG[s].contentTypeId });
                      setActiveSection(s);
                      setCreateOpen(false);
                      setDetailId(null);
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition ${
                      isActive
                        ? 'cursor-default border-neutral-900 bg-neutral-900 text-white'
                        : 'border-transparent text-neutral-700 hover:border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    <span className="min-w-0 truncate">{label}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                        isActive ? 'bg-white/15 text-white' : 'bg-neutral-100 text-neutral-700'
                      }`}
                      aria-label={`${label} count`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
            </aside>

            <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white p-0">
              <HubCachedEntryList
                key={`${cfg.contentTypeId}-${listVersion}`}
                model={activeModel}
                contentTypeId={cfg.contentTypeId}
                entryLocale={entryLocale}
                entityPluralLabel={cfg.entityPluralLabel}
                primaryFieldId={cfg.primaryFieldId}
                newLabel={cfg.newLabel}
                onNew={openCreate}
                onEdit={openDetail}
                embedded
                emptyCopyScope="resume"
                restrictToEntryIds={listRestrictToResumeLinks}
                onDeleteMany={async (ids) => {
                  for (const id of ids) {
                    await actions.deleteEntryAction(id);
                    useHubStore.getState().remove(activeModel, id);
                  }
                  setListVersion((v) => v + 1);
                }}
              />
            </section>
          </div>
        </div>
      </div>
      </div>
      )}

      {activeSection === 'experience' ? (
        <HubExperienceSideSheet
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) setListVersion((v) => v + 1);
          }}
          entryLocale={entryLocale}
          contentfulSpaceId={contentfulSpaceId}
          actions={actions}
          mode="create"
          entryId={null}
          onMutated={() => {
            setListVersion((v) => v + 1);
          }}
          onCreated={() => setCreateOpen(false)}
        />
      ) : activeSection === 'course' ? (
        <HubCourseSideSheet
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) setListVersion((v) => v + 1);
          }}
          entryLocale={entryLocale}
          actions={actions}
          mode="create"
          entryId={null}
          onMutated={() => {
            setListVersion((v) => v + 1);
          }}
          onCreated={() => setCreateOpen(false)}
        />
      ) : activeSection === 'study' ? (
        <HubStudySideSheet
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) setListVersion((v) => v + 1);
          }}
          entryLocale={entryLocale}
          actions={actions}
          mode="create"
          entryId={null}
          onMutated={() => {
            setListVersion((v) => v + 1);
          }}
          onCreated={() => setCreateOpen(false)}
        />
      ) : activeSection === 'language' ? (
        <HubLanguageSideSheet
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) setListVersion((v) => v + 1);
          }}
          entryLocale={entryLocale}
          actions={actions}
          mode="create"
          entryId={null}
          onMutated={() => {
            setListVersion((v) => v + 1);
          }}
          onCreated={() => setCreateOpen(false)}
        />
      ) : null}
    </div>
  );
}

