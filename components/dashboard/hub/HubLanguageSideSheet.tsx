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
import { Loader2, Trash2, X } from 'lucide-react';
import type { ArtActions } from '@/components/dashboard/art/ArtDashboard';
import { readLocalizedField } from '@/lib/contentful/readLocalizedField';
import { fetchEntry, fetchFirstResumeId, mergeLink, unwrapLocaleCell } from '@/components/dashboard/hub/_resumeLinking';
import { upsertHubEntryFromManagementApi } from '@/lib/store/syncHubEntryFromManagement';
import { useHubStore } from '@/lib/store/hubStore';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import { ConfirmDiscardDialog } from '@/components/ui/ConfirmDiscardDialog';

type Draft = {
  nameEn: string;
  nameEs: string;
  levelEn: string;
  levelEs: string;
};

export function HubLanguageSideSheet(props: {
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
    nameEn: '',
    nameEs: '',
    levelEn: '',
    levelEs: '',
  }));
  const baselineRef = React.useRef<Draft>({ nameEn: '', nameEs: '', levelEn: '', levelEs: '' });
  const [confirmDiscardOpen, setConfirmDiscardOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (mode !== 'create') return;
    setDraft({ nameEn: '', nameEs: '', levelEn: '', levelEs: '' });
    baselineRef.current = { nameEn: '', nameEs: '', levelEn: '', levelEs: '' };
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
          nameEn: readLocalizedField(f.nameEn, entryLocale),
          nameEs: readLocalizedField(f.nameEs, entryLocale),
          levelEn: readLocalizedField(f.levelEn, entryLocale),
          levelEs: readLocalizedField(f.levelEs, entryLocale),
        };
        baselineRef.current = nextDraft;
        setDraft(nextDraft);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load language');
      } finally {
        if (!cancelled) setLoadingEntry(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entryId, entryLocale, mode, open]);

  const title = mode === 'create' ? 'New Language' : 'Edit Language';
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
        nameEn: draft.nameEn.trim(),
        nameEs: draft.nameEs.trim(),
        levelEn: draft.levelEn.trim(),
        levelEs: draft.levelEs.trim(),
      };

      if (mode === 'create') {
        const created = await actions.createEntryAction({ contentTypeId: 'language', fields: payloadFields });
        await actions.publishEntryAction(created.id);
        await upsertHubEntryFromManagementApi('language', created.id);

        if (resumeId) {
          const resume = await fetchEntry(resumeId);
          const resumeFields = (resume?.fields ?? {}) as Record<string, any>;
          const cell = unwrapLocaleCell(resumeFields.languages, entryLocale);
          const merged = mergeLink(cell, created.id);
          await actions.updateEntryAction({ entryId: resumeId, fields: { languages: merged.valueToPersist } });
          await actions.publishEntryAction(resumeId);
        }

        onMutated?.();
        onCreated?.(created.id);
        return;
      }

      if (!entryId) throw new Error('Missing entryId');
      await actions.updateEntryAction({ entryId, fields: payloadFields });
      await actions.publishEntryAction(entryId);
      await upsertHubEntryFromManagementApi('language', entryId);
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
      useHubStore.getState().remove('language', entryId);
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
                  <Label className="text-sm">Name EN</Label>
                  <Input value={draft.nameEn} onChange={(e) => setDraft((p) => ({ ...p, nameEn: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm">Name ES</Label>
                  <Input value={draft.nameEs} onChange={(e) => setDraft((p) => ({ ...p, nameEs: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm">Level EN</Label>
                  <Input value={draft.levelEn} onChange={(e) => setDraft((p) => ({ ...p, levelEn: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm">Level ES</Label>
                  <Input value={draft.levelEs} onChange={(e) => setDraft((p) => ({ ...p, levelEs: e.target.value }))} />
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
        title="Eliminar language"
        description="Vas a eliminar este language. Esta acción no se puede deshacer."
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

