'use client';

import * as React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import type { ArtActions } from '@/components/dashboard/art/ArtDashboard';
import { readLocalizedField } from '@/lib/contentful/readLocalizedField';
import { EntryReferenceMultiSelect, type EntryLink } from '@/components/cms/EntryReferenceMultiSelect';
import { upsertHubEntryFromManagementApi } from '@/lib/store/syncHubEntryFromManagement';
import { useHubStore } from '@/lib/store/hubStore';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';

const HUB_MANAGEMENT_API = '/api/contentful/hub';

type ExperienceDraft = {
  companyEn: string;
  companyEs: string;
  roleEn: string;
  roleEs: string;
  descriptionEn: string;
  descriptionEs: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (empty = current)
  techs: EntryLink[]; // UI multi, model currently single-link; we persist first only.
};

function toLink(id: string): EntryLink {
  return { sys: { type: 'Link', linkType: 'Entry', id } };
}

function asDateCell(v: string): string | null {
  const s = (v || '').trim();
  if (!s) return null;
  // Contentful "Date" expects YYYY-MM-DD.
  return s;
}

async function fetchFirstResumeId(): Promise<string | null> {
  const q = new URLSearchParams({ contentType: 'resume', limit: '1', skip: '0' });
  const res = await fetch(`${HUB_MANAGEMENT_API}/entries?${q.toString()}`, { cache: 'no-store' });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data?.error || 'Failed to load resume');
  const first = data?.items?.[0];
  return typeof first?.sys?.id === 'string' ? (first.sys.id as string) : null;
}

async function fetchEntry(entryId: string): Promise<any> {
  const res = await fetch(`${HUB_MANAGEMENT_API}/entries/${encodeURIComponent(entryId)}`, { cache: 'no-store' });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data?.error || 'Failed to load entry');
  return data?.item;
}

export function HubExperienceSideSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryLocale: string;
  contentfulSpaceId: string;
  actions: ArtActions;
  mode: 'create' | 'edit';
  entryId: string | null;
  onMutated?: () => void;
  onCreated?: (id: string) => void;
}) {
  const { open, onOpenChange, entryLocale, contentfulSpaceId, actions, mode, entryId, onMutated, onCreated } = props;

  const [busy, setBusy] = React.useState(false);
  const [loadingEntry, setLoadingEntry] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resumeId, setResumeId] = React.useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);

  const [draft, setDraft] = React.useState<ExperienceDraft>(() => ({
    companyEn: '',
    companyEs: '',
    roleEn: '',
    roleEs: '',
    descriptionEn: '',
    descriptionEs: '',
    startDate: '',
    endDate: '',
    techs: [],
  }));

  const [techPickerKey, setTechPickerKey] = React.useState(0);
  const [creatingTech, setCreatingTech] = React.useState(false);
  const [newTechEn, setNewTechEn] = React.useState('');
  const [newTechEs, setNewTechEs] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    if (mode !== 'create') return;
    setDraft({
      companyEn: '',
      companyEs: '',
      roleEn: '',
      roleEs: '',
      descriptionEn: '',
      descriptionEs: '',
      startDate: '',
      endDate: '',
      techs: [],
    });
    setNewTechEn('');
    setNewTechEs('');
    setError(null);
  }, [mode, open]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        const id = await fetchFirstResumeId();
        if (!cancelled) setResumeId(id);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load resume');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    if (mode !== 'edit' || !entryId) return;
    let cancelled = false;
    setLoadingEntry(true);
    setError(null);
    (async () => {
      try {
        const item = await fetchEntry(entryId);
        if (cancelled) return;
        const f = (item?.fields ?? {}) as Record<string, unknown>;
        const techCell = (f as any)?.techs?.[entryLocale] ?? (f as any)?.techs?.['en-US'] ?? (f as any)?.techs;
        const techLinks = Array.isArray(techCell)
          ? (techCell as any[]).filter(Boolean).map((x) => (typeof x === 'object' && x ? (x as EntryLink) : null)).filter(Boolean)
          : [];

        setDraft({
          companyEn: readLocalizedField(f.companyEn, entryLocale),
          companyEs: readLocalizedField(f.companyEs, entryLocale),
          roleEn: readLocalizedField(f.roleEn, entryLocale),
          roleEs: readLocalizedField(f.roleEs, entryLocale),
          descriptionEn: readLocalizedField(f.descriptionEn, entryLocale),
          descriptionEs: readLocalizedField(f.descriptionEs, entryLocale),
          startDate: readLocalizedField(f.startDate, entryLocale),
          endDate: readLocalizedField(f.endDate, entryLocale),
          techs: techLinks as EntryLink[],
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load experience');
      } finally {
        if (!cancelled) setLoadingEntry(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entryId, entryLocale, mode, open]);

  const title = mode === 'create' ? 'New Experience' : 'Edit Experience';

  const setField = React.useCallback(<K extends keyof ExperienceDraft>(k: K, v: ExperienceDraft[K]) => {
    setDraft((prev) => ({ ...prev, [k]: v }));
  }, []);

  const save = React.useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const payloadFields: Record<string, any> = {
        companyEn: draft.companyEn.trim(),
        companyEs: draft.companyEs.trim(),
        roleEn: draft.roleEn.trim(),
        roleEs: draft.roleEs.trim(),
        descriptionEn: draft.descriptionEn,
        descriptionEs: draft.descriptionEs,
        startDate: asDateCell(draft.startDate),
        endDate: asDateCell(draft.endDate),
      };

      payloadFields.techs = draft.techs.length ? draft.techs : [];

      if (mode === 'create') {
        const created = await actions.createEntryAction({ contentTypeId: 'experience', fields: payloadFields });
        await actions.publishEntryAction(created.id);
        await upsertHubEntryFromManagementApi('experience', created.id);

        // Link to resume.workExperience
        if (resumeId) {
          await actions.updateEntryAction({
            entryId: resumeId,
            fields: {
              // NOTE: content model currently is a single Link field.
              // If this becomes an array in the model later, this can be switched to an array of links.
              workExperience: toLink(created.id),
            },
          });
          await actions.publishEntryAction(resumeId);
        }

        onMutated?.();
        onCreated?.(created.id);
        return;
      }

      if (!entryId) throw new Error('Missing entryId');
      await actions.updateEntryAction({ entryId, fields: payloadFields });
      await actions.publishEntryAction(entryId);
      await upsertHubEntryFromManagementApi('experience', entryId);
      onMutated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  }, [actions, busy, draft, entryId, mode, onCreated, onMutated, resumeId]);

  const remove = React.useCallback(async () => {
    if (!entryId) return;
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await actions.deleteEntryAction(entryId);
      useHubStore.getState().remove('experience', entryId);
      onMutated?.();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setBusy(false);
      setConfirmDeleteOpen(false);
    }
  }, [actions, busy, entryId, onMutated, onOpenChange]);

  const createTechInline = React.useCallback(async () => {
    if (creatingTech || busy) return;
    const nameEn = newTechEn.trim();
    const nameEs = newTechEs.trim();
    if (!nameEn || !nameEs) {
      setError('Completar nameEn y nameEs para crear la tech');
      return;
    }
    setCreatingTech(true);
    setError(null);
    try {
      const created = await actions.createEntryAction({
        contentTypeId: 'tech',
        fields: { nameEn, nameEs },
      });
      await actions.publishEntryAction(created.id);
      setDraft((prev) => {
        const next = [...prev.techs];
        if (!next.some((l) => l.sys.id === created.id)) next.push(toLink(created.id));
        return { ...prev, techs: next };
      });
      setNewTechEn('');
      setNewTechEs('');
      setTechPickerKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create tech');
    } finally {
      setCreatingTech(false);
    }
  }, [actions, busy, creatingTech, newTechEn, newTechEs]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl">
          <SheetHeader className="shrink-0 border-b border-neutral-200">
            <SheetTitle className="text-base">{title}</SheetTitle>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-auto p-4">
            {error ? <p className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
            {loadingEntry ? (
              <p className="flex items-center gap-2 text-sm text-neutral-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </p>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label className="text-sm">Company EN</Label>
                    <Input value={draft.companyEn} onChange={(e) => setField('companyEn', e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm">Company ES</Label>
                    <Input value={draft.companyEs} onChange={(e) => setField('companyEs', e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm">Role EN</Label>
                    <Input value={draft.roleEn} onChange={(e) => setField('roleEn', e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm">Role ES</Label>
                    <Input value={draft.roleEs} onChange={(e) => setField('roleEs', e.target.value)} />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label className="text-sm">Start date</Label>
                    <Input type="date" value={draft.startDate} onChange={(e) => setField('startDate', e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm">End date (empty = current)</Label>
                    <Input type="date" value={draft.endDate} onChange={(e) => setField('endDate', e.target.value)} />
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label className="text-sm">Description EN</Label>
                    <Textarea value={draft.descriptionEn} onChange={(e) => setField('descriptionEn', e.target.value)} rows={6} />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm">Description ES</Label>
                    <Textarea value={draft.descriptionEs} onChange={(e) => setField('descriptionEs', e.target.value)} rows={6} />
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Label className="text-sm">Techs</Label>
                  </div>
                  <div key={techPickerKey}>
                    <EntryReferenceMultiSelect
                      value={draft.techs}
                      onChange={(next) => setField('techs', next)}
                      managementApiRoot={HUB_MANAGEMENT_API}
                      sourceContentTypeId="tech"
                      entryLocale={entryLocale}
                      searchPlaceholder="Buscar techs…"
                    />
                  </div>

                  <div className="rounded-lg border border-neutral-200 p-3">
                    <p className="text-xs font-medium text-neutral-700">Create new tech</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label className="text-xs text-neutral-600">Name EN</Label>
                        <Input value={newTechEn} onChange={(e) => setNewTechEn(e.target.value)} placeholder="e.g. React" />
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-xs text-neutral-600">Name ES</Label>
                        <Input value={newTechEs} onChange={(e) => setNewTechEs(e.target.value)} placeholder="e.g. React" />
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button type="button" size="sm" onClick={() => void createTechInline()} disabled={creatingTech || busy}>
                        {creatingTech ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                        Create tech
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-500">
                    Tip: podés seleccionar múltiples techs y también crear una nueva tech acá mismo.
                  </p>
                </div>
              </div>
            )}
          </div>

          <SheetFooter className="border-t border-neutral-200">
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {mode === 'edit' ? (
                  <Button type="button" variant="destructive" onClick={() => setConfirmDeleteOpen(true)} disabled={busy}>
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Delete
                  </Button>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                  <X className="mr-2 h-4 w-4" />
                  Close
                </Button>
                <Button type="button" onClick={() => void save()} disabled={busy || loadingEntry}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save
                </Button>
              </div>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Eliminar experience"
        description="Vas a eliminar esta experience. Esta acción no se puede deshacer."
        busy={busy}
        onConfirm={remove}
      />
    </>
  );
}

