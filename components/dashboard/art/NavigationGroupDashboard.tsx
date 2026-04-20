'use client';

import * as React from 'react';
import { EntryEditor } from '@/components/cms/EntryEditor';
import { EntryList } from '@/components/cms/EntryList';
import type {
  ArtActions,
  ArtMode,
} from '@/components/dashboard/art/ArtDashboard';
import { useContentfulStore } from '@/lib/store/contentfulStore';
import { upsertEntryFromManagementApi } from '@/lib/store/syncEntryFromManagement';

export function NavigationGroupDashboard(props: {
  entryLocale: string;
  contentfulSpaceId: string;
  actions: ArtActions;
}) {
  const { entryLocale, contentfulSpaceId, actions } = props;
  const [mode, setMode] = React.useState<ArtMode>('list');
  const [selectedEntryId, setSelectedEntryId] = React.useState<string | null>(
    null
  );

  const goList = React.useCallback(() => {
    setMode('list');
    setSelectedEntryId(null);
  }, []);

  const goCreate = React.useCallback(() => {
    setMode('create');
    setSelectedEntryId(null);
  }, []);

  const goEdit = React.useCallback((id: string) => {
    setMode('edit');
    setSelectedEntryId(id);
  }, []);

  const prefetchedEntry = React.useMemo(() => {
    if (mode !== 'edit' || !selectedEntryId) return undefined;
    return useContentfulStore
      .getState()
      .getNavigationGroupById(selectedEntryId);
  }, [mode, selectedEntryId]);

  const editorLabels = React.useMemo(
    () => ({
      createSubtitle: 'New Project group',
      createEmptyTitle: 'New Project group',
      editEmptyTitle: 'Project group',
      publishToast: 'Project group published',
      unpublishToast: 'Project group unpublished',
      deleteDialogTitle: 'Delete project group',
      deleteDialogDescription: (liveTitle: string) =>
        `Are you sure you want to delete the project group '${liveTitle}'?`,
    }),
    []
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0">
      {mode === 'list' ? (
        <EntryList
          contentTypeId="navigationGroup"
          cacheModel="navigationGroup"
          entryLocale={entryLocale}
          entityPluralLabel="Project groups"
          primaryFieldId="title"
          newLabel="New Project group"
          refreshLabel="Refresh"
          refreshingLabel="Refreshing…"
          onNew={goCreate}
          onEdit={goEdit}
          onDeleteMany={async (ids) => {
            for (const id of ids) {
              await actions.deleteEntryAction(id);
              useContentfulStore.getState().remove('navigationGroup', id);
            }
          }}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <EntryEditor
            contentTypeId="navigationGroup"
            entryLocale={entryLocale}
            contentfulSpaceId={contentfulSpaceId}
            actions={actions}
            mode={mode}
            entryId={selectedEntryId}
            prefetchedEntry={prefetchedEntry}
            onBack={goList}
            onCreated={async (id) => {
              await upsertEntryFromManagementApi('navigationGroup', id);
              goEdit(id);
            }}
            labels={editorLabels}
          />
        </div>
      )}
    </div>
  );
}
