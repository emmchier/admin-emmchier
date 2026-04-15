'use client';

import * as React from 'react';
import { EntryEditor } from '@/components/cms/EntryEditor';
import { EntryList } from '@/components/cms/EntryList';
import type { ArtActions, ArtMode } from '@/components/dashboard/art/ArtDashboard';
import { useContentfulStore } from '@/lib/store/contentfulStore';
import { upsertEntryFromManagementApi } from '@/lib/store/syncEntryFromManagement';

export function TechDashboard(props: { entryLocale: string; contentfulSpaceId: string; actions: ArtActions }) {
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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0">
      {mode === 'list' ? (
        <EntryList
          contentTypeId="tech"
          cacheModel="tech"
          entryLocale={entryLocale}
          entityPluralLabel="Techs"
          primaryFieldId="name"
          newLabel="New tech"
          refreshLabel="Refresh"
          refreshingLabel="Refreshing…"
          onNew={goCreate}
          onEdit={goEdit}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <EntryEditor
            contentTypeId="tech"
            entryLocale={entryLocale}
            contentfulSpaceId={contentfulSpaceId}
            actions={actions}
            mode={mode}
            entryId={selectedEntryId}
            prefetchedEntry={
              mode === 'edit' && selectedEntryId
                ? useContentfulStore.getState().getTechById(selectedEntryId)
                : undefined
            }
            onBack={goList}
            onCreated={async (id) => {
              await upsertEntryFromManagementApi('tech', id);
              goEdit(id);
            }}
            displayTitleFieldId="name"
            labels={{
              createSubtitle: 'Nueva tecnología',
              createEmptyTitle: 'Nueva tecnología',
              editEmptyTitle: 'Tech',
              publishToast: 'Tech publicado',
              unpublishToast: 'Tech oculto',
              deleteDialogTitle: 'Eliminar tech',
              deleteDialogDescription: (liveTitle) =>
                `¿Estás seguro que querés eliminar el tech '${liveTitle}'?`,
            }}
          />
        </div>
      )}
    </div>
  );
}
