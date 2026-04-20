'use client';

import * as React from 'react';
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import type { ArtActions } from '@/components/dashboard/art/ArtDashboard';
import { isEntryPublished } from '@/lib/contentful/isEntryPublished';
import { readLocalizedField } from '@/lib/contentful/readLocalizedField';
import { useHubStore } from '@/lib/store/hubStore';
import { toast } from '@/lib/ui/snackbar';
import type { EntryLink } from '@/components/cms/EntryReferenceMultiSelect';
import { dedupeEntryLinks } from '@/lib/utils/dedupeEntryLinks';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';

function toLink(id: string): EntryLink {
  return { sys: { type: 'Link', linkType: 'Entry', id } };
}

function readTechLabel(e: any, locale: string) {
  return readLocalizedField(e?.fields?.nameEn, locale) || readLocalizedField(e?.fields?.name, locale) || e?.sys?.id || '';
}

function TechStoreMultiSelect(props: { value: EntryLink[]; onChange: (next: EntryLink[]) => void; entryLocale: string }) {
  const { value, onChange, entryLocale } = props;
  const techs = useHubStore((s) => s.techs);
  const loaded = useHubStore((s) => s.loaded.tech);
  const [q, setQ] = React.useState('');

  if (!loaded) {
    return <p className="text-xs text-neutral-500">Techs not loaded (flow error).</p>;
  }

  const normalizedValue = React.useMemo(() => dedupeEntryLinks(value), [value]);
  const safeOnChange = React.useCallback(
    (next: EntryLink[]) => {
      onChange(dedupeEntryLinks(next));
    },
    [onChange],
  );
  const selected = new Set(normalizedValue.map((l) => l.sys.id));
  const candidates = Object.values(techs) as any[];
  const filtered = q.trim()
    ? candidates.filter((t) => readTechLabel(t, entryLocale).toLowerCase().includes(q.trim().toLowerCase()))
    : candidates;

  return (
    <div className="grid gap-2">
      <div className="flex min-h-9 flex-wrap gap-2">
        {normalizedValue.length === 0 ? <span className="text-xs text-neutral-500">Ninguno seleccionado.</span> : null}
        {normalizedValue.map((l, idx) => (
          <span key={`${l.sys.id}-${idx}`} className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-800">
            {readTechLabel(techs[l.sys.id], entryLocale) || l.sys.id}
          </span>
        ))}
      </div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar techs…" />
      <div className="max-h-48 overflow-auto rounded-md border border-neutral-200">
        {filtered.map((t) => {
          const id = t.sys.id as string;
          const active = selected.has(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                if (active) safeOnChange(normalizedValue.filter((x) => x.sys.id !== id));
                else safeOnChange([...normalizedValue, toLink(id)]);
              }}
              className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition ${
                active ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-50'
              }`}
            >
              <span className="truncate font-medium">{readTechLabel(t, entryLocale) || id}</span>
              <span className="font-mono text-[10px] opacity-70">{active ? '✓' : '+'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Header(props: { title: string; entry: any; onBack: () => void; actions: React.ReactNode }) {
  return (
    <div className="shrink-0 space-y-3 px-4 pt-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={props.onBack}
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Go back</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <StatusBadge entry={props.entry} />
          <h2 className="truncate text-base font-semibold text-neutral-900">{props.title}</h2>
        </div>
        <div className="flex items-center gap-2">{props.actions}</div>
      </div>
    </div>
  );
}

export function HubTechDetail(props: { entryId: string; entryLocale: string; actions: ArtActions; onBack: () => void; onDeleted?: () => void }) {
  const { entryId, entryLocale, actions, onBack, onDeleted } = props;
  const entry = useHubStore((s) => s.techs[entryId]);
  const published = isEntryPublished(entry?.sys);
  const [busy, setBusy] = React.useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [nameEn, setNameEn] = React.useState('');
  const [nameEs, setNameEs] = React.useState('');

  React.useEffect(() => {
    if (!entry) return;
    setNameEn(readLocalizedField(entry.fields?.nameEn, entryLocale));
    setNameEs(readLocalizedField(entry.fields?.nameEs, entryLocale));
  }, [entry, entryLocale]);

  if (!entry) return <p className="px-4 py-10 text-sm text-neutral-600">Missing entry in store (flow error).</p>;

  const dirty =
    readLocalizedField(entry.fields?.nameEn, entryLocale) !== nameEn || readLocalizedField(entry.fields?.nameEs, entryLocale) !== nameEs;

  const save = async () => {
    if (busy || !dirty) return;
    setBusy(true);
    try {
      const fields = { nameEn: nameEn.trim(), nameEs: nameEs.trim() };
      useHubStore.getState().updateFields('tech', { entryId, locale: entryLocale, fields });
      await actions.updateEntryAction({ entryId, fields });
      await actions.publishEntryAction(entryId);
      toast.success('Guardado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await actions.deleteEntryAction(entryId);
      useHubStore.getState().remove('tech', entryId);
      onDeleted?.();
      onBack();
      toast.success('Deleted');
    } finally {
      setBusy(false);
      setConfirmDeleteOpen(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-white">
      <Header
        title={nameEn || 'Tech'}
        entry={entry}
        onBack={onBack}
        actions={
          <>
            <Button type="button" size="sm" onClick={() => void save()} disabled={busy || !dirty}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmDeleteOpen(true)} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete
            </Button>
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-auto pb-[72px] pt-4">
        <div className="px-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label className="text-sm">Name EN</Label>
            <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label className="text-sm">Name ES</Label>
            <Input value={nameEs} onChange={(e) => setNameEs(e.target.value)} />
          </div>
        </div>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Eliminar tech"
        description="Vas a eliminar esta tech. Esta acción no se puede deshacer."
        busy={busy}
        onConfirm={remove}
      />
    </div>
  );
}

export function HubCourseDetail(props: { entryId: string; entryLocale: string; actions: ArtActions; onBack: () => void; onDeleted?: () => void }) {
  const { entryId, entryLocale, actions, onBack, onDeleted } = props;
  const entry = useHubStore((s) => s.courses[entryId]);
  const published = isEntryPublished(entry?.sys);
  const [busy, setBusy] = React.useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [draft, setDraft] = React.useState({ companyEn: '', companyEs: '', titleEn: '', titleEs: '', startDate: '', endDate: '' });

  React.useEffect(() => {
    if (!entry) return;
    setDraft({
      companyEn: readLocalizedField(entry.fields?.companyEn, entryLocale),
      companyEs: readLocalizedField(entry.fields?.companyEs, entryLocale),
      titleEn: readLocalizedField(entry.fields?.titleEn, entryLocale),
      titleEs: readLocalizedField(entry.fields?.titleEs, entryLocale),
      startDate: readLocalizedField(entry.fields?.startDate, entryLocale),
      endDate: readLocalizedField(entry.fields?.endDate, entryLocale),
    });
  }, [entry, entryLocale]);

  if (!entry) return <p className="px-4 py-10 text-sm text-neutral-600">Missing entry in store (flow error).</p>;

  const dirty = Object.entries(draft).some(([k, v]) => readLocalizedField((entry.fields as any)?.[k], entryLocale) !== v);

  const save = async () => {
    if (busy || !dirty) return;
    setBusy(true);
    try {
      const fields = { ...draft, companyEn: draft.companyEn.trim(), companyEs: draft.companyEs.trim(), titleEn: draft.titleEn.trim(), titleEs: draft.titleEs.trim() };
      useHubStore.getState().updateFields('course', { entryId, locale: entryLocale, fields });
      await actions.updateEntryAction({ entryId, fields });
      await actions.publishEntryAction(entryId);
      toast.success('Guardado');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await actions.deleteEntryAction(entryId);
      useHubStore.getState().remove('course', entryId);
      onDeleted?.();
      onBack();
      toast.success('Deleted');
    } finally {
      setBusy(false);
      setConfirmDeleteOpen(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-white">
      <Header
        title={draft.titleEn || 'Course'}
        entry={entry}
        onBack={onBack}
        actions={
          <>
            <Button type="button" size="sm" onClick={() => void save()} disabled={busy || !dirty}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmDeleteOpen(true)} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete
            </Button>
          </>
        }
      />
      <div className="min-h-0 flex-1 overflow-auto pb-[72px] pt-4">
        <div className="px-4">
        <div className="grid gap-4 md:grid-cols-2">
          {(['companyEn','companyEs','titleEn','titleEs'] as const).map((k) => (
            <div key={k} className="grid gap-2">
              <Label className="text-sm">{k}</Label>
              <Input value={(draft as any)[k]} onChange={(e) => setDraft((p) => ({ ...p, [k]: e.target.value }))} />
            </div>
          ))}
        </div>
        <Separator className="my-4" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label className="text-sm">startDate</Label>
            <Input type="date" value={draft.startDate} onChange={(e) => setDraft((p) => ({ ...p, startDate: e.target.value }))} />
          </div>
          <div className="grid gap-2">
            <Label className="text-sm">endDate</Label>
            <Input type="date" value={draft.endDate} onChange={(e) => setDraft((p) => ({ ...p, endDate: e.target.value }))} />
          </div>
        </div>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Eliminar course"
        description="Vas a eliminar este course. Esta acción no se puede deshacer."
        busy={busy}
        onConfirm={remove}
      />
    </div>
  );
}

export function HubStudyDetail(props: { entryId: string; entryLocale: string; actions: ArtActions; onBack: () => void; onDeleted?: () => void }) {
  const { entryId, entryLocale, actions, onBack, onDeleted } = props;
  const entry = useHubStore((s) => s.studies[entryId]);
  const published = isEntryPublished(entry?.sys);
  const [busy, setBusy] = React.useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [draft, setDraft] = React.useState({ schoolEn: '', schoolEs: '', titleEn: '', titleEs: '', startDate: '', endDate: '' });

  React.useEffect(() => {
    if (!entry) return;
    setDraft({
      schoolEn: readLocalizedField(entry.fields?.schoolEn, entryLocale),
      schoolEs: readLocalizedField(entry.fields?.schoolEs, entryLocale),
      titleEn: readLocalizedField(entry.fields?.titleEn, entryLocale),
      titleEs: readLocalizedField(entry.fields?.titleEs, entryLocale),
      startDate: readLocalizedField(entry.fields?.startDate, entryLocale),
      endDate: readLocalizedField(entry.fields?.endDate, entryLocale),
    });
  }, [entry, entryLocale]);

  if (!entry) return <p className="px-4 py-10 text-sm text-neutral-600">Missing entry in store (flow error).</p>;
  const dirty = Object.entries(draft).some(([k, v]) => readLocalizedField((entry.fields as any)?.[k], entryLocale) !== v);

  const save = async () => {
    if (busy || !dirty) return;
    setBusy(true);
    try {
      const fields = { ...draft, schoolEn: draft.schoolEn.trim(), schoolEs: draft.schoolEs.trim(), titleEn: draft.titleEn.trim(), titleEs: draft.titleEs.trim() };
      useHubStore.getState().updateFields('study', { entryId, locale: entryLocale, fields });
      await actions.updateEntryAction({ entryId, fields });
      await actions.publishEntryAction(entryId);
      toast.success('Guardado');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await actions.deleteEntryAction(entryId);
      useHubStore.getState().remove('study', entryId);
      onDeleted?.();
      onBack();
      toast.success('Deleted');
    } finally {
      setBusy(false);
      setConfirmDeleteOpen(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-white">
      <Header
        title={draft.titleEn || 'Study'}
        entry={entry}
        onBack={onBack}
        actions={
          <>
            <Button type="button" size="sm" onClick={() => void save()} disabled={busy || !dirty}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmDeleteOpen(true)} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete
            </Button>
          </>
        }
      />
      <div className="min-h-0 flex-1 overflow-auto pb-[72px] pt-4">
        <div className="px-4">
        <div className="grid gap-4 md:grid-cols-2">
          {(['schoolEn','schoolEs','titleEn','titleEs'] as const).map((k) => (
            <div key={k} className="grid gap-2">
              <Label className="text-sm">{k}</Label>
              <Input value={(draft as any)[k]} onChange={(e) => setDraft((p) => ({ ...p, [k]: e.target.value }))} />
            </div>
          ))}
        </div>
        <Separator className="my-4" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label className="text-sm">startDate</Label>
            <Input type="date" value={draft.startDate} onChange={(e) => setDraft((p) => ({ ...p, startDate: e.target.value }))} />
          </div>
          <div className="grid gap-2">
            <Label className="text-sm">endDate</Label>
            <Input type="date" value={draft.endDate} onChange={(e) => setDraft((p) => ({ ...p, endDate: e.target.value }))} />
          </div>
        </div>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Eliminar study"
        description="Vas a eliminar este study. Esta acción no se puede deshacer."
        busy={busy}
        onConfirm={remove}
      />
    </div>
  );
}

export function HubLanguageDetail(props: { entryId: string; entryLocale: string; actions: ArtActions; onBack: () => void; onDeleted?: () => void }) {
  const { entryId, entryLocale, actions, onBack, onDeleted } = props;
  const entry = useHubStore((s) => s.languages[entryId]);
  const published = isEntryPublished(entry?.sys);
  const [busy, setBusy] = React.useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [draft, setDraft] = React.useState({ nameEn: '', nameEs: '', levelEn: '', levelEs: '' });

  React.useEffect(() => {
    if (!entry) return;
    setDraft({
      nameEn: readLocalizedField(entry.fields?.nameEn, entryLocale),
      nameEs: readLocalizedField(entry.fields?.nameEs, entryLocale),
      levelEn: readLocalizedField(entry.fields?.levelEn, entryLocale),
      levelEs: readLocalizedField(entry.fields?.levelEs, entryLocale),
    });
  }, [entry, entryLocale]);

  if (!entry) return <p className="px-4 py-10 text-sm text-neutral-600">Missing entry in store (flow error).</p>;
  const dirty = Object.entries(draft).some(([k, v]) => readLocalizedField((entry.fields as any)?.[k], entryLocale) !== v);

  const save = async () => {
    if (busy || !dirty) return;
    setBusy(true);
    try {
      const fields = { ...draft, nameEn: draft.nameEn.trim(), nameEs: draft.nameEs.trim(), levelEn: draft.levelEn.trim(), levelEs: draft.levelEs.trim() };
      useHubStore.getState().updateFields('language', { entryId, locale: entryLocale, fields });
      await actions.updateEntryAction({ entryId, fields });
      await actions.publishEntryAction(entryId);
      toast.success('Guardado');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await actions.deleteEntryAction(entryId);
      useHubStore.getState().remove('language', entryId);
      onDeleted?.();
      onBack();
      toast.success('Deleted');
    } finally {
      setBusy(false);
      setConfirmDeleteOpen(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-white">
      <Header
        title={draft.nameEn || 'Language'}
        entry={entry}
        onBack={onBack}
        actions={
          <>
            <Button type="button" size="sm" onClick={() => void save()} disabled={busy || !dirty}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmDeleteOpen(true)} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete
            </Button>
          </>
        }
      />
      <div className="min-h-0 flex-1 overflow-auto pb-[72px] pt-4">
        <div className="px-4">
        <div className="grid gap-4 md:grid-cols-2">
          {(['nameEn','nameEs','levelEn','levelEs'] as const).map((k) => (
            <div key={k} className="grid gap-2">
              <Label className="text-sm">{k}</Label>
              <Input value={(draft as any)[k]} onChange={(e) => setDraft((p) => ({ ...p, [k]: e.target.value }))} />
            </div>
          ))}
        </div>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Eliminar language"
        description="Vas a eliminar este language. Esta acción no se puede deshacer."
        busy={busy}
        onConfirm={remove}
      />
    </div>
  );
}

export function HubExperienceDetail(props: { entryId: string; entryLocale: string; actions: ArtActions; onBack: () => void; onDeleted?: () => void }) {
  const { entryId, entryLocale, actions, onBack, onDeleted } = props;
  const entry = useHubStore((s) => s.experiences[entryId]);
  const published = isEntryPublished(entry?.sys);
  const [busy, setBusy] = React.useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [draft, setDraft] = React.useState({
    companyEn: '',
    companyEs: '',
    roleEn: '',
    roleEs: '',
    descriptionEn: '',
    descriptionEs: '',
    startDate: '',
    endDate: '',
    techs: [] as EntryLink[],
  });

  React.useEffect(() => {
    if (!entry) return;
    const techCell = (entry.fields as any)?.techs?.[entryLocale] ?? (entry.fields as any)?.techs?.['en-US'] ?? (entry.fields as any)?.techs ?? [];
    setDraft({
      companyEn: readLocalizedField(entry.fields?.companyEn, entryLocale),
      companyEs: readLocalizedField(entry.fields?.companyEs, entryLocale),
      roleEn: readLocalizedField(entry.fields?.roleEn, entryLocale),
      roleEs: readLocalizedField(entry.fields?.roleEs, entryLocale),
      descriptionEn: readLocalizedField(entry.fields?.descriptionEn, entryLocale),
      descriptionEs: readLocalizedField(entry.fields?.descriptionEs, entryLocale),
      startDate: readLocalizedField(entry.fields?.startDate, entryLocale),
      endDate: readLocalizedField(entry.fields?.endDate, entryLocale),
      techs: Array.isArray(techCell) ? (techCell as EntryLink[]) : [],
    });
  }, [entry, entryLocale]);

  if (!entry) return <p className="px-4 py-10 text-sm text-neutral-600">Missing entry in store (flow error).</p>;
  const dirty = true; // keep simple; save always enabled

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const fields: Record<string, any> = {
        companyEn: draft.companyEn.trim(),
        companyEs: draft.companyEs.trim(),
        roleEn: draft.roleEn.trim(),
        roleEs: draft.roleEs.trim(),
        descriptionEn: draft.descriptionEn,
        descriptionEs: draft.descriptionEs,
        startDate: draft.startDate || null,
        endDate: draft.endDate || null,
        techs: draft.techs,
      };
      useHubStore.getState().updateFields('experience', { entryId, locale: entryLocale, fields });
      await actions.updateEntryAction({ entryId, fields });
      await actions.publishEntryAction(entryId);
      toast.success('Guardado');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await actions.deleteEntryAction(entryId);
      useHubStore.getState().remove('experience', entryId);
      onDeleted?.();
      onBack();
      toast.success('Deleted');
    } finally {
      setBusy(false);
      setConfirmDeleteOpen(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-white">
      <Header
        title={draft.roleEn || 'Experience'}
        entry={entry}
        onBack={onBack}
        actions={
          <>
            <Button type="button" size="sm" onClick={() => void save()} disabled={busy || !dirty}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmDeleteOpen(true)} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete
            </Button>
          </>
        }
      />
      <div className="min-h-0 flex-1 overflow-auto pb-[72px] pt-4">
        <div className="px-4">
        <div className="grid gap-4 md:grid-cols-2">
          {(['companyEn','companyEs','roleEn','roleEs'] as const).map((k) => (
            <div key={k} className="grid gap-2">
              <Label className="text-sm">{k}</Label>
              <Input value={(draft as any)[k]} onChange={(e) => setDraft((p) => ({ ...p, [k]: e.target.value }))} />
            </div>
          ))}
        </div>
        <Separator className="my-4" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label className="text-sm">startDate</Label>
            <Input type="date" value={draft.startDate} onChange={(e) => setDraft((p) => ({ ...p, startDate: e.target.value }))} />
          </div>
          <div className="grid gap-2">
            <Label className="text-sm">endDate</Label>
            <Input type="date" value={draft.endDate} onChange={(e) => setDraft((p) => ({ ...p, endDate: e.target.value }))} />
          </div>
        </div>
        <Separator className="my-4" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label className="text-sm">descriptionEn</Label>
            <Textarea value={draft.descriptionEn} onChange={(e) => setDraft((p) => ({ ...p, descriptionEn: e.target.value }))} rows={6} />
          </div>
          <div className="grid gap-2">
            <Label className="text-sm">descriptionEs</Label>
            <Textarea value={draft.descriptionEs} onChange={(e) => setDraft((p) => ({ ...p, descriptionEs: e.target.value }))} rows={6} />
          </div>
        </div>
        <Separator className="my-4" />
        <div className="grid gap-2">
          <Label className="text-sm">Techs</Label>
          <TechStoreMultiSelect value={draft.techs} onChange={(next) => setDraft((p) => ({ ...p, techs: next }))} entryLocale={entryLocale} />
        </div>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Eliminar experience"
        description="Vas a eliminar esta experience. Esta acción no se puede deshacer."
        busy={busy}
        onConfirm={remove}
      />
    </div>
  );
}

