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

export function CategoryDashboard(props: {
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
    return useContentfulStore.getState().getCategoryById(selectedEntryId);
  }, [mode, selectedEntryId]);

  const editorLabels = React.useMemo(
    () => ({
      createSubtitle: 'New Category',
      createEmptyTitle: 'New Category',
      editEmptyTitle: 'Category',
      publishToast: 'Category published',
      unpublishToast: 'Category unpublished',
      deleteDialogTitle: 'Delete category',
      deleteDialogDescription: (liveTitle: string) =>
        `Are you sure you want to delete the category '${liveTitle}'?`,
    }),
    []
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0">
      {mode === 'list' ? (
        <EntryList
          contentTypeId="category"
          cacheModel="category"
          entryLocale={entryLocale}
          entityPluralLabel="Categories"
          primaryFieldId="title"
          newLabel="New Category"
          refreshLabel="Refresh"
          refreshingLabel="Refreshing…"
          onNew={goCreate}
          onEdit={goEdit}
          onDeleteMany={async (ids) => {
            for (const id of ids) {
              await actions.deleteEntryAction(id);
              useContentfulStore.getState().remove('category', id);
            }
          }}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <EntryEditor
            contentTypeId="category"
            entryLocale={entryLocale}
            contentfulSpaceId={contentfulSpaceId}
            actions={actions}
            mode={mode}
            entryId={selectedEntryId}
            prefetchedEntry={prefetchedEntry}
            onBack={goList}
            onCreated={async (id) => {
              await upsertEntryFromManagementApi('category', id);
              goEdit(id);
            }}
            labels={editorLabels}
          />
        </div>
      )}
    </div>
  );
}
