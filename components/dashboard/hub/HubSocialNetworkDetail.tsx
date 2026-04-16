'use client';

import * as React from 'react';
import { ArrowLeft, Eye, EyeOff, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isEntryPublished } from '@/lib/contentful/isEntryPublished';
import type { ArtActions } from '@/components/dashboard/art/ArtDashboard';
import { readLocalizedField } from '@/lib/contentful/readLocalizedField';
import { useHubStore } from '@/lib/store/hubStore';
import { toast } from '@/lib/ui/snackbar';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';

export function HubSocialNetworkDetail(props: {
  entryId: string;
  entryLocale: string;
  actions: ArtActions;
  onBack: () => void;
  onDeleted?: () => void;
}) {
  const { entryId, entryLocale, actions, onBack, onDeleted } = props;
  const entry = useHubStore((s) => s.socialNetworks[entryId]);
  const published = isEntryPublished(entry?.sys);

  const [platform, setPlatform] = React.useState('');
  const [url, setUrl] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);

  React.useEffect(() => {
    if (!entry) return;
    setPlatform(readLocalizedField(entry.fields?.platform, entryLocale));
    setUrl(readLocalizedField(entry.fields?.url, entryLocale));
    setUsername(readLocalizedField(entry.fields?.username, entryLocale));
  }, [entry, entryLocale]);

  const dirty = React.useMemo(() => {
    if (!entry) return false;
    const p0 = readLocalizedField(entry.fields?.platform, entryLocale);
    const u0 = readLocalizedField(entry.fields?.url, entryLocale);
    const us0 = readLocalizedField(entry.fields?.username, entryLocale);
    return p0 !== platform || u0 !== url || us0 !== username;
  }, [entry, entryLocale, platform, url, username]);

  if (!entry) {
    return (
      <div className="flex min-h-0 flex-1 flex-col px-4 py-10">
        <p className="text-sm text-neutral-600">Missing entry in store (flow error).</p>
        <div className="mt-4">
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  const save = async () => {
    if (busy || !dirty) return;
    setBusy(true);
    try {
      const fields = {
        platform: platform.trim(),
        url: url.trim(),
        username: username.trim(),
      };

      // optimistic store update (no GET)
      useHubStore.getState().updateFields('socialNetwork', { entryId, locale: entryLocale, fields });

      await actions.updateEntryAction({ entryId, fields });
      await actions.publishEntryAction(entryId);

      // optimistic publish stamp for badge
      useHubStore.getState().updateFields('socialNetwork', {
        entryId,
        locale: entryLocale,
        fields: {},
        sysPatch: { publishedAt: new Date().toISOString(), publishedVersion: 1, publishedCounter: 1 },
      });

      toast.success('Guardado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  const togglePublish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (published) {
        await actions.unpublishEntryAction(entryId);
        useHubStore.getState().updateFields('socialNetwork', {
          entryId,
          locale: entryLocale,
          fields: {},
          sysPatch: { publishedAt: undefined, publishedVersion: 0, publishedCounter: 0 },
        });
        toast.success('Oculto');
      } else {
        await actions.publishEntryAction(entryId);
        useHubStore.getState().updateFields('socialNetwork', {
          entryId,
          locale: entryLocale,
          fields: {},
          sysPatch: { publishedAt: new Date().toISOString(), publishedVersion: 1, publishedCounter: 1 },
        });
        toast.success('Publicado');
      }
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
      useHubStore.getState().remove('socialNetwork', entryId);
      toast.success('Eliminado');
      onDeleted?.();
      onBack();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setBusy(false);
      setConfirmDeleteOpen(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-white">
      <div className="shrink-0 space-y-3 px-4 pt-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-neutral-900">{platform || 'Social Network'}</h2>
              <div className="mt-1">
                <Badge className={published ? 'bg-emerald-600 text-white hover:bg-emerald-600' : ''} variant={published ? 'default' : 'secondary'}>
                  {published ? 'Publicado' : 'Borrador'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={togglePublish}
              disabled={busy}
              aria-label={published ? 'Ocultar' : 'Publicar'}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              <span className="sr-only">{published ? 'Ocultar' : 'Publicar'}</span>
            </Button>
            <Button type="button" size="sm" onClick={() => void save()} disabled={busy || !dirty}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar cambios
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void save()} disabled aria-hidden className="hidden">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 pb-[72px] pt-4">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label className="text-sm">Platform</Label>
            <Input value={platform} onChange={(e) => setPlatform(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label className="text-sm">Url</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label className="text-sm">Username</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>

          <div className="pt-2">
            <Button type="button" variant="destructive" onClick={() => setConfirmDeleteOpen(true)} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Eliminar social network"
        description="Vas a eliminar esta social network. Esta acción no se puede deshacer."
        busy={busy}
        onConfirm={remove}
      />
    </div>
  );
}

