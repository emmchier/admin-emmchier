'use client';

import * as React from 'react';
import type { ArtActions } from '@/components/dashboard/art/ArtDashboard';
import { EntryEditor } from '@/components/cms/EntryEditor';
import { toast } from '@/lib/ui/snackbar';
import { HubCachedEntryList } from '@/components/dashboard/hub/HubCachedEntryList';
import { ensureHubModelLoaded } from '@/lib/store/ensureHubModelLoaded';
import { useHubStore } from '@/lib/store/hubStore';
import { HubSocialNetworkSideSheet } from '@/components/dashboard/hub/HubSocialNetworkSideSheet';
import { contentfulService } from '@/services/contentfulService';

const HUB_MANAGEMENT_API = '/api/contentful/hub';

export function HubContactsDashboard(props: {
  entryLocale: string;
  contentfulSpaceId: string;
  actions: ArtActions;
}) {
  const { entryLocale, contentfulSpaceId, actions } = props;
  const [listVersion, setListVersion] = React.useState(0);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [createSheetOpen, setCreateSheetOpen] = React.useState(false);

  const socialLoaded = useHubStore((s) => s.loaded.socialNetwork);

  React.useEffect(() => {
    if (socialLoaded) return;
    void ensureHubModelLoaded('socialNetwork').catch((e) => {
      toast.error(e instanceof Error ? e.message : 'Failed to load social networks');
    });
  }, [socialLoaded]);

  const openCreateSocial = React.useCallback(() => setCreateSheetOpen(true), []);
  const openDetail = React.useCallback((id: string) => {
    setDetailId(id);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white px-0 pt-0">
      <div className="grid min-h-0 flex-1 grid-cols-12 overflow-hidden bg-white">
        <div className="col-span-12 flex min-h-0 flex-1 flex-col lg:col-start-3 lg:col-span-8">
          {detailId ? (
            <div className="min-h-0 flex-1">
              <EntryEditor
                contentTypeId="socialNetwork"
                entryLocale={entryLocale}
                contentfulSpaceId={contentfulSpaceId}
                managementApiRoot={HUB_MANAGEMENT_API}
                actions={actions}
                mode="edit"
                entryId={detailId}
                displayTitleFieldId="platform"
                onBack={() => setDetailId(null)}
                onCreated={() => {}}
                labels={{
                  editEmptyTitle: 'Social network',
                  save: 'Save changes',
                  deleteDialogTitle: 'Delete social network',
                  deleteDialogDescription: (t) => `Delete the social network '${t}'?`,
                  publishToast: 'Social network published',
                  unpublishToast: 'Social network unpublished',
                }}
                onConfirmDelete={async ({ entryId: deletingId }) => {
                  await actions.deleteEntryAction(deletingId);
                  useHubStore.getState().remove('socialNetwork', deletingId);
                  setDetailId(null);
                  setListVersion((v) => v + 1);
                }}
              />
            </div>
          ) : (
            <section className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
              <HubCachedEntryList
                key={`socialNetwork-${listVersion}`}
                model="socialNetwork"
                contentTypeId="socialNetwork"
                entryLocale={entryLocale}
                entityPluralLabel="Social Networks"
                primaryFieldId="platform"
                newLabel="Add new Social Network"
                onNew={openCreateSocial}
                newButtonPlacement="search"
                newButtonClassName="gap-2 bg-zinc-900 text-white hover:bg-zinc-800"
                searchInputClassName="w-1/2"
                onDeleteMany={async (ids) => {
                  for (const deletingId of ids) {
                    await actions.deleteEntryAction(deletingId);
                    useHubStore.getState().remove('socialNetwork', deletingId);
                  }
                  setListVersion((v) => v + 1);
                }}
                onEdit={openDetail}
                embedded
              />
            </section>
          )}
        </div>
      </div>

      <HubSocialNetworkSideSheet
        open={createSheetOpen}
        onOpenChange={(open) => {
          setCreateSheetOpen(open);
          if (!open) setListVersion((v) => v + 1);
        }}
        actions={actions}
        onCreated={async (id) => {
          try {
            const created = await contentfulService.getEntryById({ space: 'hub', entryId: id });
            useHubStore.getState().upsert('socialNetwork', created);
          } catch (e) {
            // fall back to list refresh by version bump
          } finally {
            setListVersion((v) => v + 1);
          }
        }}
      />
    </div>
  );
}

