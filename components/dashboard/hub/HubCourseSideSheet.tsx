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
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Loader2, Trash2, X } from 'lucide-react';
import type { ArtActions } from '@/components/dashboard/art/ArtDashboard';
import { readLocalizedField } from '@/lib/contentful/readLocalizedField';
import { asDateCell, fetchEntry, fetchFirstResumeId, mergeLink, unwrapLocaleCell } from '@/components/dashboard/hub/_resumeLinking';
import { upsertHubEntryFromManagementApi } from '@/lib/store/syncHubEntryFromManagement';
import { useHubStore } from '@/lib/store/hubStore';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import { ConfirmDiscardDialog } from '@/components/ui/ConfirmDiscardDialog';

type Draft = {
  companyEn: string;
  companyEs: string;
  titleEn: string;
  titleEs: string;
  startDate: string;
  endDate: string;
};

export function HubCourseSideSheet(props: {
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
    companyEn: '',
    companyEs: '',
    titleEn: '',
    titleEs: '',
    startDate: '',
    endDate: '',
  }));
  const baselineRef = React.useRef<Draft>({
    companyEn: '',
    companyEs: '',
    titleEn: '',
    titleEs: '',
    startDate: '',
    endDate: '',
  });
  const [confirmDiscardOpen, setConfirmDiscardOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (mode !== 'create') return;
    setDraft({ companyEn: '', companyEs: '', titleEn: '', titleEs: '', startDate: '', endDate: '' });
    baselineRef.current = { companyEn: '', companyEs: '', titleEn: '', titleEs: '', startDate: '', endDate: '' };
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
        const nextDraft = {
          companyEn: readLocalizedField(f.companyEn, entryLocale),
          companyEs: readLocalizedField(f.companyEs, entryLocale),
          titleEn: readLocalizedField(f.titleEn, entryLocale),
          titleEs: readLocalizedField(f.titleEs, entryLocale),
          startDate: readLocalizedField(f.startDate, entryLocale),
          endDate: readLocalizedField(f.endDate, entryLocale),
        };
        baselineRef.current = nextDraft;
        setDraft(nextDraft);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load course');
      } finally {
        if (!cancelled) setLoadingEntry(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entryId, entryLocale, mode, open]);

  const title = mode === 'create' ? 'New Course' : 'Edit Course';
  const isDirty = JSON.stringify(draft) !== JSON.stringify(baselineRef.current);

  const requestClose = React.useCallback(() => {
    if (busy) return;
    if (isDirty) {
      setConfirmDiscardOpen(true);
      return;
    }
    onOpenChange(false);
  }, [busy, isDirty, onOpenChange]);

  const save = React.useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const payloadFields: Record<string, any> = {
        companyEn: draft.companyEn.trim(),
        companyEs: draft.companyEs.trim(),
        titleEn: draft.titleEn.trim(),
        titleEs: draft.titleEs.trim(),
        startDate: asDateCell(draft.startDate),
        endDate: asDateCell(draft.endDate),
      };

      if (mode === 'create') {
        const created = await actions.createEntryAction({ contentTypeId: 'course', fields: payloadFields });
        await actions.publishEntryAction(created.id);
        await upsertHubEntryFromManagementApi('course', created.id);

        if (resumeId) {
          const resume = await fetchEntry(resumeId);
          const resumeFields = (resume?.fields ?? {}) as Record<string, any>;
          const cell = unwrapLocaleCell(resumeFields.courses, entryLocale);
          const merged = mergeLink(cell, created.id);
          await actions.updateEntryAction({ entryId: resumeId, fields: { courses: merged.valueToPersist } });
          await actions.publishEntryAction(resumeId);
        }

        onMutated?.();
        onCreated?.(created.id);
        return;
      }

      if (!entryId) throw new Error('Missing entryId');
      await actions.updateEntryAction({ entryId, fields: payloadFields });
      await actions.publishEntryAction(entryId);
      await upsertHubEntryFromManagementApi('course', entryId);
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
      useHubStore.getState().remove('course', entryId);
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
                  <Input value={draft.companyEn} onChange={(e) => setDraft((p) => ({ ...p, companyEn: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm">Company ES</Label>
                  <Input value={draft.companyEs} onChange={(e) => setDraft((p) => ({ ...p, companyEs: e.target.value }))} />
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

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Eliminar course"
        description="Vas a eliminar este course. Esta acción no se puede deshacer."
        busy={busy}
        onConfirm={remove}
      />
      </Sheet>

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


