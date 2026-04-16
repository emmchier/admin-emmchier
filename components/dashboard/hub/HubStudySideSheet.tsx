'use client';

import * as React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Loader2, Trash2, X } from 'lucide-react';
import type { ArtActions } from '@/components/dashboard/art/ArtDashboard';
import { readLocalizedField } from '@/lib/contentful/readLocalizedField';
import { asDateCell, fetchEntry, fetchFirstResumeId, mergeLink, unwrapLocaleCell } from '@/components/dashboard/hub/_resumeLinking';
import { upsertHubEntryFromManagementApi } from '@/lib/store/syncHubEntryFromManagement';
import { useHubStore } from '@/lib/store/hubStore';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';

type Draft = {
  schoolEn: string;
  schoolEs: string;
  titleEn: string;
  titleEs: string;
  startDate: string;
  endDate: string;
};

export function HubStudySideSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryLocale: string;
  actions: ArtActions;
  mode: 'create' | 'edit';
  entryId: string | null;
  onMutated?: () => void;
  onCreated?: (id: string) => void;
}) {
  const { open, onOpenChange, entryLocale, actions, mode, entryId, onMutated, onCreated } = props;
  const [busy, setBusy] = React.useState(false);
  const [loadingEntry, setLoadingEntry] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resumeId, setResumeId] = React.useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);

  const [draft, setDraft] = React.useState<Draft>(() => ({
    schoolEn: '',
    schoolEs: '',
    titleEn: '',
    titleEs: '',
    startDate: '',
    endDate: '',
  }));

  React.useEffect(() => {
    if (!open) return;
    if (mode !== 'create') return;
    setDraft({ schoolEn: '', schoolEs: '', titleEn: '', titleEs: '', startDate: '', endDate: '' });
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
        setDraft({
          schoolEn: readLocalizedField(f.schoolEn, entryLocale),
          schoolEs: readLocalizedField(f.schoolEs, entryLocale),
          titleEn: readLocalizedField(f.titleEn, entryLocale),
          titleEs: readLocalizedField(f.titleEs, entryLocale),
          startDate: readLocalizedField(f.startDate, entryLocale),
          endDate: readLocalizedField(f.endDate, entryLocale),
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load study');
      } finally {
        if (!cancelled) setLoadingEntry(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entryId, entryLocale, mode, open]);

  const title = mode === 'create' ? 'New Study' : 'Edit Study';

  const save = React.useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const payloadFields: Record<string, any> = {
        schoolEn: draft.schoolEn.trim(),
        schoolEs: draft.schoolEs.trim(),
        titleEn: draft.titleEn.trim(),
        titleEs: draft.titleEs.trim(),
        startDate: asDateCell(draft.startDate),
        endDate: asDateCell(draft.endDate),
      };

      if (mode === 'create') {
        const created = await actions.createEntryAction({ contentTypeId: 'study', fields: payloadFields });
        await actions.publishEntryAction(created.id);
        await upsertHubEntryFromManagementApi('study', created.id);

        if (resumeId) {
          const resume = await fetchEntry(resumeId);
          const resumeFields = (resume?.fields ?? {}) as Record<string, any>;
          const cell = unwrapLocaleCell(resumeFields.studies, entryLocale);
          const merged = mergeLink(cell, created.id);
          await actions.updateEntryAction({ entryId: resumeId, fields: { studies: merged.valueToPersist } });
          await actions.publishEntryAction(resumeId);
        }

        onMutated?.();
        onCreated?.(created.id);
        return;
      }

      if (!entryId) throw new Error('Missing entryId');
      await actions.updateEntryAction({ entryId, fields: payloadFields });
      await actions.publishEntryAction(entryId);
      await upsertHubEntryFromManagementApi('study', entryId);
      onMutated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  }, [actions, busy, draft, entryId, entryLocale, mode, onCreated, onMutated, resumeId]);

  const remove = React.useCallback(async () => {
    if (!entryId) return;
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await actions.deleteEntryAction(entryId);
      useHubStore.getState().remove('study', entryId);
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
                  <Label className="text-sm">School EN</Label>
                  <Input value={draft.schoolEn} onChange={(e) => setDraft((p) => ({ ...p, schoolEn: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm">School ES</Label>
                  <Input value={draft.schoolEs} onChange={(e) => setDraft((p) => ({ ...p, schoolEs: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm">Title EN</Label>
                  <Input value={draft.titleEn} onChange={(e) => setDraft((p) => ({ ...p, titleEn: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm">Title ES</Label>
                  <Input value={draft.titleEs} onChange={(e) => setDraft((p) => ({ ...p, titleEs: e.target.value }))} />
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label className="text-sm">Start date</Label>
                  <Input type="date" value={draft.startDate} onChange={(e) => setDraft((p) => ({ ...p, startDate: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm">End date</Label>
                  <Input type="date" value={draft.endDate} onChange={(e) => setDraft((p) => ({ ...p, endDate: e.target.value }))} />
                </div>
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

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Eliminar study"
        description="Vas a eliminar este study. Esta acción no se puede deshacer."
        busy={busy}
        onConfirm={remove}
      />
    </Sheet>
  );
}

