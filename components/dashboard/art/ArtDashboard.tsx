'use client';

import * as React from 'react';
import { EntryEditor } from '@/components/cms/EntryEditor';
import { EntryList } from '@/components/cms/EntryList';
import { useContentfulStore } from '@/lib/store/contentfulStore';
import { upsertEntryFromManagementApi } from '@/lib/store/syncEntryFromManagement';

export type ArtMode = 'list' | 'create' | 'edit';

export type ArtActions = {
  createEntryAction: (args: { contentTypeId: string; fields: Record<string, any> }) => Promise<{ id: string }>;
  updateEntryAction: (args: { entryId: string; fields: Record<string, any> }) => Promise<{ ok: boolean }>;
  deleteEntryAction: (entryId: string) => Promise<{ ok: boolean }>;
  publishEntryAction: (entryId: string) => Promise<{ ok: boolean }>;
  unpublishEntryAction: (entryId: string) => Promise<{ ok: boolean }>;
};

export function ArtDashboard(props: { entryLocale: string; contentfulSpaceId: string; actions: ArtActions }) {
  const { entryLocale, contentfulSpaceId, actions } = props;
  const [mode, setMode] = React.useState<ArtMode>('list');
  const [selectedEntryId, setSelectedEntryId] = React.useState<string | null>(null);

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
    return useContentfulStore.getState().getProjectById(selectedEntryId);
  }, [mode, selectedEntryId]);

  const editorLabels = React.useMemo(
    () => ({
      createSubtitle: 'Nuevo proyecto',
      createEmptyTitle: 'Nuevo proyecto',
      editEmptyTitle: 'Proyecto',
      publishToast: 'Proyecto publicado',
      unpublishToast: 'Proyecto oculto',
      deleteDialogTitle: 'Eliminar proyecto',
      deleteDialogDescription: (liveTitle: string) =>
        `¿Estás seguro que querés eliminar el proyecto '${liveTitle}'?`,
    }),
    [],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0">
      {mode === 'list' ? (
        <EntryList
          contentTypeId="project"
          cacheModel="project"
          entryLocale={entryLocale}
          entityPluralLabel="Projects"
          newLabel="New Project"
          refreshLabel="Refresh"
          refreshingLabel="Refreshing…"
          statusPublishedLabel="Published"
          statusDraftLabel="Draft"
          onNew={goCreate}
          onEdit={goEdit}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <EntryEditor
            contentTypeId="project"
            entryLocale={entryLocale}
            contentfulSpaceId={contentfulSpaceId}
            actions={actions}
            mode={mode}
            entryId={selectedEntryId}
            prefetchedEntry={prefetchedEntry}
            onBack={goList}
            onCreated={async (id) => {
              await upsertEntryFromManagementApi('project', id);
              goEdit(id);
            }}
            labels={editorLabels}
          />
        </div>
      )}
    </div>
  );
}

