'use client';

import * as React from 'react';
import type { ArtActions } from '@/components/dashboard/art/ArtDashboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Save } from 'lucide-react';
import { HubEntrySideSheet } from '@/components/dashboard/hub/HubEntrySideSheet';
import type { EntryLink } from '@/components/cms/EntryReferenceMultiSelect';
import { toast } from '@/lib/ui/snackbar';
import { HubCachedEntryList } from '@/components/dashboard/hub/HubCachedEntryList';
import { ensureHubModelLoaded } from '@/lib/store/ensureHubModelLoaded';
import { useHubStore } from '@/lib/store/hubStore';
import { HubSocialNetworkDetail } from '@/components/dashboard/hub/HubSocialNetworkDetail';

const HUB_MANAGEMENT_API = '/api/contentful/hub';

function toLink(id: string): EntryLink {
  return { sys: { type: 'Link', linkType: 'Entry', id } };
}

function readLinks(raw: unknown): EntryLink[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as EntryLink[];
  if (typeof raw === 'object' && (raw as any)?.sys?.type === 'Link') return [raw as EntryLink];
  // CMA may wrap by locale; we only expect hub API returns localized objects; keep simple.
  return [];
}

async function fetchFirstContactEntry(): Promise<any | null> {
  const q = new URLSearchParams({ contentType: 'contact', limit: '1', skip: '0' });
  const res = await fetch(`${HUB_MANAGEMENT_API}/entries?${q.toString()}`, { cache: 'no-store' });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data?.error || 'Failed to load contact');
  const first = data?.items?.[0];
  return first ?? null;
}

async function fetchEntry(entryId: string): Promise<any> {
  const res = await fetch(`${HUB_MANAGEMENT_API}/entries/${encodeURIComponent(entryId)}`, { cache: 'no-store' });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data?.error || 'Failed to load entry');
  return data?.item;
}

export function HubContactsDashboard(props: {
  entryLocale: string;
  contentfulSpaceId: string;
  actions: ArtActions;
}) {
  const { entryLocale, contentfulSpaceId, actions } = props;

  const [contactEntryId, setContactEntryId] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState('');
  const [emailInitial, setEmailInitial] = React.useState('');
  const [loadingContact, setLoadingContact] = React.useState(false);
  const [savingEmail, setSavingEmail] = React.useState(false);

  const [createSheetOpen, setCreateSheetOpen] = React.useState(false);
  const [listVersion, setListVersion] = React.useState(0);
  const [detailId, setDetailId] = React.useState<string | null>(null);

  const contactsRecord = useHubStore((s) => s.contacts);
  const contactsLoaded = useHubStore((s) => s.loaded.contact);

  const hydrateFromStore = React.useCallback(() => {
    const first = Object.values(useHubStore.getState().contacts)[0] as any | undefined;
    const id = typeof first?.sys?.id === 'string' ? (first.sys.id as string) : null;
    setContactEntryId(id);
    const rawEmail = first?.fields?.email;
    const nextEmail =
      typeof rawEmail === 'object' && rawEmail?.[entryLocale] ? String(rawEmail[entryLocale]) : String(rawEmail ?? '');
    setEmail(nextEmail);
    setEmailInitial(nextEmail);
  }, [entryLocale]);

  React.useEffect(() => {
    // Lazy load contact list once; cache-first thereafter.
    if (contactsLoaded) {
      hydrateFromStore();
      return;
    }
    setLoadingContact(true);
    (async () => {
      try {
        await ensureHubModelLoaded('contact');
        hydrateFromStore();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load contact');
      } finally {
        setLoadingContact(false);
      }
    })();
  }, [contactsLoaded, hydrateFromStore]);

  // Keep local email in sync if store changes (e.g. after save elsewhere).
  React.useEffect(() => {
    if (!contactsLoaded) return;
    hydrateFromStore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactsLoaded, contactsRecord]);

  const emailDirty = email.trim() !== emailInitial.trim();

  const saveEmail = React.useCallback(async () => {
    if (!contactEntryId) {
      toast.error('Missing contact entry');
      return;
    }
    if (!emailDirty) return;
    setSavingEmail(true);
    try {
      // Optimistic store update (no refetch).
      useHubStore.getState().updateFields('contact', { entryId: contactEntryId, locale: entryLocale, fields: { email: email.trim() } });
      await actions.updateEntryAction({ entryId: contactEntryId, fields: { email: email.trim() } });
      await actions.publishEntryAction(contactEntryId);
      setEmailInitial(email.trim());
      toast.success('Email actualizado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save email');
    } finally {
      setSavingEmail(false);
    }
  }, [actions, contactEntryId, email, emailDirty, entryLocale]);

  const openCreateSocial = React.useCallback(() => {
    setCreateSheetOpen(true);
  }, []);

  const openDetail = React.useCallback((id: string) => {
    setDetailId(id);
  }, []);

  const linkSocialNetworkToContact = React.useCallback(
    async (socialNetworkId: string) => {
      if (!contactEntryId) return;
      const contact = await fetchEntry(contactEntryId);
      const f = (contact?.fields ?? {}) as Record<string, any>;
      const cell = f.socialNetworks?.[entryLocale] ?? f.socialNetworks?.['en-US'] ?? f.socialNetworks;
      const existing = readLinks(cell);
      const next = [...existing];
      if (!next.some((l) => l.sys.id === socialNetworkId)) next.push(toLink(socialNetworkId));

      // Persist: supports both array field and single link field (fallback = first).
      const valueToPersist: any = Array.isArray(cell) ? next : next[0] ?? null;
      await actions.updateEntryAction({ entryId: contactEntryId, fields: { socialNetworks: valueToPersist } });
      await actions.publishEntryAction(contactEntryId);
    },
    [actions, contactEntryId, entryLocale],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white px-0 pt-0">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
        <section className="shrink-0 bg-white">
          <div className="w-fit px-4 pt-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-neutral-900">Email</h2>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => void saveEmail()}
                  disabled={!emailDirty || savingEmail || loadingContact || !contactEntryId}
                >
                  {savingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span className="sr-only">Save</span>
                </Button>
              </div>
            </div>
            <div className="mt-4">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@domain.com"
                disabled={loadingContact}
                className="w-60"
              />
            </div>
          </div>

          <div className="min-h-0 w-fit overflow-auto px-4 pb-[72px] pt-4">
            {loadingContact ? (
              <p className="flex items-center gap-2 text-sm text-neutral-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </p>
            ) : (
              <div />
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
          {detailId ? (
            <HubSocialNetworkDetail
              entryId={detailId}
              entryLocale={entryLocale}
              actions={actions}
              onBack={() => setDetailId(null)}
              onDeleted={() => setListVersion((v) => v + 1)}
            />
          ) : (
            <HubCachedEntryList
              key={`socialNetwork-${listVersion}`}
              model="socialNetwork"
              contentTypeId="socialNetwork"
              entryLocale={entryLocale}
              entityPluralLabel="Social Networks"
              primaryFieldId="platform"
              newLabel="New Social Network"
              onNew={openCreateSocial}
              onEdit={openDetail}
            />
          )}
        </section>
      </div>

      <HubEntrySideSheet
        open={createSheetOpen}
        onOpenChange={(open) => {
          setCreateSheetOpen(open);
          if (!open) setListVersion((v) => v + 1);
        }}
        title="New Social Network"
        entryLocale={entryLocale}
        contentfulSpaceId={contentfulSpaceId}
        actions={actions}
        contentTypeId="socialNetwork"
        displayTitleFieldId="platform"
        mode="create"
        entryId={null}
        labels={{
          createSubtitle: 'Nueva red',
          createEmptyTitle: 'Nueva red',
          editEmptyTitle: 'Red social',
          publishToast: 'Red publicada',
          unpublishToast: 'Red oculta',
          deleteDialogTitle: 'Eliminar red',
          deleteDialogDescription: (t) => `¿Eliminar la red '${t}'?`,
        }}
        onMutated={() => setListVersion((v) => v + 1)}
        onCreated={async (id) => {
          try {
            await linkSocialNetworkToContact(id);
            setListVersion((v) => v + 1);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to link social network');
          }
        }}
      />
    </div>
  );
}

