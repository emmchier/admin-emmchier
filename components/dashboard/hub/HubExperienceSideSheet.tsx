'use client';

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetScrollBody,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import type { ArtActions } from '@/components/dashboard/art/ArtDashboard';
import { readLocalizedField } from '@/lib/contentful/readLocalizedField';
import type { EntryLink } from '@/components/cms/EntryReferenceMultiSelect';
import { HubTechsPicker } from '@/components/cms/HubTechsPicker';
import { upsertHubEntryFromManagementApi } from '@/lib/store/syncHubEntryFromManagement';
import { useHubStore } from '@/lib/store/hubStore';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import { contentfulService } from '@/services/contentfulService';
import { ConfirmDiscardDialog } from '@/components/ui/ConfirmDiscardDialog';

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
  const items = await contentfulService.getEntriesCached({ space: 'hub', contentTypeId: 'resume' });
  const first = items?.[0] as any;
  return typeof first?.sys?.id === 'string' ? String(first.sys.id) : null;
}

async function fetchEntry(entryId: string): Promise<any> {
  return await contentfulService.getEntryById({ space: 'hub', entryId });
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
  const baselineRef = React.useRef<ExperienceDraft>({
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
  const [confirmDiscardOpen, setConfirmDiscardOpen] = React.useState(false);

  const [techPickerKey, setTechPickerKey] = React.useState(0);

  React.useEffect(() => {
    if (!open) return;
    if (mode !== 'create') return;
    const nextDraft: ExperienceDraft = {
      companyEn: '',
      companyEs: '',
      roleEn: '',
      roleEs: '',
      descriptionEn: '',
      descriptionEs: '',
      startDate: '',
      endDate: '',
      techs: [],
    };
    baselineRef.current = nextDraft;
    setDraft(nextDraft);
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

        const nextDraft: ExperienceDraft = {
          companyEn: readLocalizedField(f.companyEn, entryLocale),
          companyEs: readLocalizedField(f.companyEs, entryLocale),
          roleEn: readLocalizedField(f.roleEn, entryLocale),
          roleEs: readLocalizedField(f.roleEs, entryLocale),
          descriptionEn: readLocalizedField(f.descriptionEn, entryLocale),
          descriptionEs: readLocalizedField(f.descriptionEs, entryLocale),
          startDate: readLocalizedField(f.startDate, entryLocale),
          endDate: readLocalizedField(f.endDate, entryLocale),
          techs: techLinks as EntryLink[],
        };
        baselineRef.current = nextDraft;
        setDraft(nextDraft);
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
  const isDirty = JSON.stringify(draft) !== JSON.stringify(baselineRef.current);

  const requestClose = React.useCallback(() => {
    if (busy) return;
    if (isDirty) {
      setConfirmDiscardOpen(true);
      return;
    }
    onOpenChange(false);
  }, [busy, isDirty, onOpenChange]);

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

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) onOpenChange(true);
          else requestClose();
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle className="text-base">{title}</SheetTitle>
          </SheetHeader>

          <SheetScrollBody className="pb-4 pt-2">
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
                    <HubTechsPicker
                      value={draft.techs}
                      onChange={(next) => setField('techs', next)}
                      entryLocale={entryLocale}
                      managementApiRoot={HUB_MANAGEMENT_API}
                    />
                  </div>
                </div>
              </div>
            )}
          </SheetScrollBody>

          <SheetFooter>
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
                <Button type="button" variant="outline" onClick={requestClose} disabled={busy}>
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

      <ConfirmDiscardDialog
        open={confirmDiscardOpen}
        onOpenChange={(o) => !o && setConfirmDiscardOpen(false)}
        title="Discard changes?"
        description="You have unsaved changes in this form. If you close now, they will be lost."
        discardLabel="Discard and close"
        cancelLabel="Keep editing"
        onDiscard={() => {
          setConfirmDiscardOpen(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}

