'use client';

import * as React from 'react';
import type { ArtActions } from '@/components/dashboard/art/ArtDashboard';
import type { EntryEditorLabels } from '@/components/cms/EntryEditor';
import { HubEntrySideSheet } from '@/components/dashboard/hub/HubEntrySideSheet';
import { HubExperienceSideSheet } from '@/components/dashboard/hub/HubExperienceSideSheet';
import { HubCourseSideSheet } from '@/components/dashboard/hub/HubCourseSideSheet';
import { HubStudySideSheet } from '@/components/dashboard/hub/HubStudySideSheet';
import { HubLanguageSideSheet } from '@/components/dashboard/hub/HubLanguageSideSheet';
import { HubCachedEntryList } from '@/components/dashboard/hub/HubCachedEntryList';
import { HubCourseDetail, HubExperienceDetail, HubLanguageDetail, HubStudyDetail, HubTechDetail } from '@/components/dashboard/hub/HubResumeDetails';
import { Button } from '@/components/ui/button';
import { ensureHubModelLoaded } from '@/lib/store/ensureHubModelLoaded';
import { useHubStore } from '@/lib/store/hubStore';
import { Input } from '@/components/ui/input';
import { Loader2, RefreshCw, Save, X, Plus } from 'lucide-react';
import { getHubAssetPreview } from '@/lib/hub/assetUrlCache';
import { toast } from '@/lib/ui/snackbar';

type HubResumeSection = 'experience' | 'course' | 'study' | 'language' | 'tech';

type SectionCfg = {
  label: string;
  contentTypeId: string;
  primaryFieldId: string;
  displayTitleFieldId?: string;
  entityPluralLabel: string;
  newLabel: string;
  editorLabels: Partial<EntryEditorLabels>;
};

const HUB_RESUME_SECTIONS: HubResumeSection[] = ['experience', 'course', 'study', 'language', 'tech'];

const SECTION_CONFIG: Record<HubResumeSection, SectionCfg> = {
  experience: {
    label: 'Work Experiences',
    contentTypeId: 'experience',
    primaryFieldId: 'roleEn',
    displayTitleFieldId: 'roleEn',
    entityPluralLabel: 'Work Experiences',
    newLabel: 'New Experience',
    editorLabels: {
      createSubtitle: 'Nueva experiencia',
      createEmptyTitle: 'Nueva experiencia',
      editEmptyTitle: 'Experience',
      publishToast: 'Experiencia publicada',
      unpublishToast: 'Experiencia oculta',
      deleteDialogTitle: 'Eliminar experiencia',
      deleteDialogDescription: (t) => `¿Eliminar la experiencia '${t}'?`,
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
      createSubtitle: 'Nuevo curso',
      createEmptyTitle: 'Nuevo curso',
      editEmptyTitle: 'Course',
      publishToast: 'Curso publicado',
      unpublishToast: 'Curso oculto',
      deleteDialogTitle: 'Eliminar curso',
      deleteDialogDescription: (t) => `¿Eliminar el curso '${t}'?`,
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
      createSubtitle: 'Nuevo estudio',
      createEmptyTitle: 'Nuevo estudio',
      editEmptyTitle: 'Study',
      publishToast: 'Estudio publicado',
      unpublishToast: 'Estudio oculto',
      deleteDialogTitle: 'Eliminar estudio',
      deleteDialogDescription: (t) => `¿Eliminar el estudio '${t}'?`,
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
      createSubtitle: 'Nuevo idioma',
      createEmptyTitle: 'Nuevo idioma',
      editEmptyTitle: 'Language',
      publishToast: 'Idioma publicado',
      unpublishToast: 'Idioma oculto',
      deleteDialogTitle: 'Eliminar idioma',
      deleteDialogDescription: (t) => `¿Eliminar el idioma '${t}'?`,
    },
  },
  tech: {
    label: 'Techs',
    contentTypeId: 'tech',
    primaryFieldId: 'nameEn',
    displayTitleFieldId: 'nameEn',
    entityPluralLabel: 'Techs',
    newLabel: 'New Tech',
    editorLabels: {
      createSubtitle: 'Nueva tech',
      createEmptyTitle: 'Nueva tech',
      editEmptyTitle: 'Tech',
      publishToast: 'Tech publicada',
      unpublishToast: 'Tech oculta',
      deleteDialogTitle: 'Eliminar tech',
      deleteDialogDescription: (t) => `¿Eliminar la tech '${t}'?`,
    },
  },
};

const SECTION_MODEL: Record<HubResumeSection, 'experience' | 'course' | 'study' | 'language' | 'tech'> = {
  experience: 'experience',
  course: 'course',
  study: 'study',
  language: 'language',
  tech: 'tech',
};

function sheetTitleFromNewLabel(newLabel: string, mode: 'create' | 'edit'): string {
  const trimmed = (newLabel || '').trim();
  if (!trimmed) return mode === 'create' ? 'New item' : 'Edit item';
  if (mode === 'create') return trimmed;
  const base = trimmed.toLowerCase().startsWith('new ') ? trimmed.slice(4).trim() : trimmed;
  return `Edit ${base || 'item'}`;
}

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
  const [editingRoleIdx, setEditingRoleIdx] = React.useState<number | null>(null);

  const cfg = SECTION_CONFIG[activeSection];
  const activeModel = SECTION_MODEL[activeSection];

  const openCreate = React.useCallback(() => setCreateOpen(true), []);
  const openDetail = React.useCallback((id: string) => setDetailId(id), []);

  const loaded = useHubStore((s) => s.loaded);
  const resumeLoaded = useHubStore((s) => s.loaded.resume);
  const resumeRecord = useHubStore((s) => s.resumes);
  const experienceCount = useHubStore((s) => (s.loaded.experience ? Object.keys(s.experiences).length : null));
  const courseCount = useHubStore((s) => (s.loaded.course ? Object.keys(s.courses).length : null));
  const studyCount = useHubStore((s) => (s.loaded.study ? Object.keys(s.studies).length : null));
  const languageCount = useHubStore((s) => (s.loaded.language ? Object.keys(s.languages).length : null));
  const techCount = useHubStore((s) => (s.loaded.tech ? Object.keys(s.techs).length : null));

  const resumeEntry = React.useMemo(() => {
    const first = Object.values(resumeRecord)[0] as any | undefined;
    return first ?? null;
  }, [resumeRecord]);

  const resumeId = resumeEntry?.sys?.id ? String(resumeEntry.sys.id) : null;

  const countLinks = React.useCallback(
    (fieldId: string): number => {
      if (!resumeEntry) return 0;
      const f = (resumeEntry.fields ?? {}) as Record<string, any>;
      const raw = f[fieldId];
      const cell = (raw?.[entryLocale] ?? raw?.['en-US'] ?? raw) as any;
      if (!cell) return 0;
      if (Array.isArray(cell)) return cell.filter(Boolean).length;
      if (typeof cell === 'object' && cell?.sys?.type === 'Link' && cell?.sys?.id) return 1;
      return 0;
    },
    [entryLocale, resumeEntry],
  );

  const sidebarCounts = React.useMemo(() => {
    // Always return non-negative numbers; never show placeholders like "-" that look like negative.
    const safe = (n: number | null) => Math.max(0, typeof n === 'number' ? n : 0);
    return {
      experience: safe(experienceCount ?? (resumeLoaded ? countLinks('workExperience') : 0)),
      course: safe(courseCount ?? (resumeLoaded ? countLinks('courses') : 0)),
      study: safe(studyCount ?? (resumeLoaded ? countLinks('studies') : 0)),
      language: safe(languageCount ?? (resumeLoaded ? countLinks('languages') : 0)),
      tech: safe(techCount ?? 0),
    };
  }, [countLinks, courseCount, experienceCount, languageCount, resumeLoaded, studyCount, techCount]);

  const roles = React.useMemo(() => {
    const f = (resumeEntry?.fields ?? {}) as Record<string, any>;
    const raw = f.roles ?? f.Roles ?? f.role ?? f.Role;
    const v = (raw?.[entryLocale] ?? raw?.['en-US'] ?? raw) as any;
    return Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean) : [];
  }, [entryLocale, resumeEntry]);

  React.useEffect(() => {
    // Hydrate editable roles list from resume entry (cache-first).
    setRolesDraft(roles);
    setEditingRoleIdx(null);
  }, [resumeId, roles]);

  const profileAssetId = React.useMemo(() => {
    const raw = resumeEntry?.fields?.profileImage;
    const cell = (raw?.[entryLocale] ?? raw?.['en-US'] ?? raw) as any;
    const id = cell?.sys?.id ? String(cell.sys.id) : '';
    return id || null;
  }, [entryLocale, resumeEntry]);

  // Experience detail uses tech multiselect from HUB store (no fetch in detail).
  // Ensure techs are available at the dashboard layer (lazy + cache-first).
  React.useEffect(() => {
    if (activeSection !== 'experience') return;
    void ensureHubModelLoaded('tech');
  }, [activeSection]);

  React.useEffect(() => {
    if (resumeLoaded) return;
    void ensureHubModelLoaded('resume');
  }, [resumeLoaded]);

  React.useEffect(() => {
    let cancelled = false;
    if (!profileAssetId) {
      setAvatarUrl(null);
      return;
    }
    void getHubAssetPreview(profileAssetId).then((p) => {
      if (!cancelled) setAvatarUrl(p.url ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [profileAssetId]);

  const onPickAvatar = React.useCallback(
    async (file: File | null) => {
      if (!file || !resumeId) return;
      setAvatarBusy(true);
      try {
        const form = new FormData();
        form.set('file', file);
        form.set('title', 'Profile image');
        form.set('alt', 'Profile image');
        const res = await fetch('/api/upload?space=hub', { method: 'POST', body: form });
        const data = (await res.json()) as any;
        if (!res.ok) throw new Error(data?.error || 'Upload failed');
        const assetId = String(data?.assetId ?? '');
        if (!assetId) throw new Error('Missing assetId');

        const link = { sys: { type: 'Link', linkType: 'Asset', id: assetId } };

        useHubStore.getState().updateFields('resume', {
          entryId: resumeId,
          locale: entryLocale,
          fields: { profileImage: link },
        });

        await actions.updateEntryAction({ entryId: resumeId, fields: { profileImage: link } });
        await actions.publishEntryAction(resumeId);

        const preview = await getHubAssetPreview(assetId);
        setAvatarUrl(preview.url ?? null);
        toast.success('Avatar actualizado');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al actualizar avatar');
      } finally {
        setAvatarBusy(false);
      }
    },
    [actions, entryLocale, resumeId],
  );

  const rolesDirty = React.useMemo(() => {
    const a = roles.map((s) => s.trim()).filter(Boolean);
    const b = rolesDraft.map((s) => s.trim()).filter(Boolean);
    return JSON.stringify(a) !== JSON.stringify(b);
  }, [roles, rolesDraft]);

  const saveRoles = React.useCallback(async () => {
    if (!resumeId) return;
    if (!rolesDirty) return;
    if (rolesBusy) return;
    setRolesBusy(true);
    try {
      const nextRoles = rolesDraft.map((s) => s.trim()).filter(Boolean);
      // Optimistic update
      useHubStore.getState().updateFields('resume', { entryId: resumeId, locale: entryLocale, fields: { roles: nextRoles } });
      await actions.updateEntryAction({ entryId: resumeId, fields: { roles: nextRoles } });
      await actions.publishEntryAction(resumeId);
      toast.success('Roles guardados');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar roles');
    } finally {
      setRolesBusy(false);
    }
  }, [actions, entryLocale, resumeId, rolesBusy, rolesDirty, rolesDraft]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      {/* Header full width */}
      <div className="shrink-0 py-4">
        <div className="flex items-start gap-6">
          <div className="ml-4 w-60 shrink-0">
            <div className="rounded-2xl bg-neutral-100 p-4">
              <div className="flex items-center gap-4">
                <label className="group relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-full border border-neutral-200 bg-white">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  e.target.value = '';
                  void onPickAvatar(f);
                }}
              />
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-linear-to-br from-neutral-100 to-neutral-200" />
              )}
              <div className="absolute inset-0 hidden items-center justify-center bg-black/40 text-[10px] font-medium text-white group-hover:flex">
                {avatarBusy ? '...' : 'Edit'}
              </div>
            </label>
            <div className="min-w-0">
              <p className="truncate text-[20px] font-bold leading-tight text-neutral-900">Emmanuel</p>
              <p className="truncate text-[20px] font-bold leading-tight text-neutral-900">Chierchie</p>
            </div>
              </div>
            </div>
          </div>

          <div className="min-w-0 w-fit max-w-[50%] rounded-2xl border border-neutral-200 bg-transparent p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Roles</p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setRolesDraft((prev) => {
                      const next = [...prev, ''];
                      setEditingRoleIdx(next.length - 1);
                      return next;
                    });
                  }}
                  disabled={!resumeId}
                >
                  <Plus className="h-4 w-4" />
                  <span className="sr-only">Add role</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => void saveRoles()}
                  disabled={!rolesDirty || rolesBusy || !resumeId}
                >
                  {rolesBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span className="sr-only">Save</span>
                </Button>
              </div>
            </div>

            <div className="mt-3">
              {rolesDraft.length === 0 ? <p className="text-xs text-neutral-500">—</p> : null}

              <div className="flex flex-wrap gap-2">
                {rolesDraft.map((r, idx) => {
                  const editing = editingRoleIdx === idx;
                  return (
                    <div
                      key={`${idx}-${r}`}
                      className="group inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-900"
                    >
                      {editing ? (
                        <Input
                          value={r}
                          autoFocus
                          onChange={(e) => {
                            const v = e.target.value;
                            setRolesDraft((prev) => prev.map((x, i) => (i === idx ? v : x)));
                          }}
                          onBlur={() => setEditingRoleIdx(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === 'Escape') setEditingRoleIdx(null);
                          }}
                          className="h-7 w-40 border-neutral-200 bg-white px-2 text-xs"
                        />
                      ) : (
                        <button type="button" className="truncate" onClick={() => setEditingRoleIdx(idx)}>
                          {r || '—'}
                        </button>
                      )}

                      <button
                        type="button"
                        className="rounded p-0.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                        aria-label="Remove role"
                        onClick={() => {
                          setRolesDraft((prev) => prev.filter((_, i) => i !== idx));
                          setEditingRoleIdx((cur) => (cur === idx ? null : cur != null && cur > idx ? cur - 1 : cur));
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="mx-4 flex w-60 shrink-0 flex-col bg-white py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Sections</p>

          <nav className="mt-3 min-h-0 flex-1 overflow-auto" aria-label="Resumé sections">
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
                        : s === 'language'
                          ? sidebarCounts.language
                          : sidebarCounts.tech;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={isActive}
                    onClick={() => {
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
          {detailId ? (
            activeSection === 'experience' ? (
              <HubExperienceDetail entryId={detailId} entryLocale={entryLocale} actions={actions} onBack={() => setDetailId(null)} onDeleted={() => setListVersion((v) => v + 1)} />
            ) : activeSection === 'course' ? (
              <HubCourseDetail entryId={detailId} entryLocale={entryLocale} actions={actions} onBack={() => setDetailId(null)} onDeleted={() => setListVersion((v) => v + 1)} />
            ) : activeSection === 'study' ? (
              <HubStudyDetail entryId={detailId} entryLocale={entryLocale} actions={actions} onBack={() => setDetailId(null)} onDeleted={() => setListVersion((v) => v + 1)} />
            ) : activeSection === 'language' ? (
              <HubLanguageDetail entryId={detailId} entryLocale={entryLocale} actions={actions} onBack={() => setDetailId(null)} onDeleted={() => setListVersion((v) => v + 1)} />
            ) : (
              <HubTechDetail entryId={detailId} entryLocale={entryLocale} actions={actions} onBack={() => setDetailId(null)} onDeleted={() => setListVersion((v) => v + 1)} />
            )
          ) : (
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
            />
          )}
        </section>
      </div>

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
      ) : (
        <HubEntrySideSheet
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) setListVersion((v) => v + 1);
          }}
          title={sheetTitleFromNewLabel(cfg.newLabel, 'create')}
          entryLocale={entryLocale}
          contentfulSpaceId={contentfulSpaceId}
          actions={actions}
          contentTypeId={cfg.contentTypeId}
          displayTitleFieldId={cfg.displayTitleFieldId}
          mode="create"
          entryId={null}
          labels={cfg.editorLabels}
          onMutated={() => {
            setListVersion((v) => v + 1);
          }}
          onCreated={() => setCreateOpen(false)}
        />
      )}
    </div>
  );
}

