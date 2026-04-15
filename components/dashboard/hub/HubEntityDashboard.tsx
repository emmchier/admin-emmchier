'use client';

import * as React from 'react';
import { EntryEditor, type EntryEditorLabels } from '@/components/cms/EntryEditor';
import { EntryList } from '@/components/cms/EntryList';
import type { ArtActions, ArtMode } from '@/components/dashboard/art/ArtDashboard';

const HUB_MANAGEMENT_API = '/api/contentful/hub';

export type HubEntityDashboardProps = {
  entryLocale: string;
  contentfulSpaceId: string;
  actions: ArtActions;
  contentTypeId: string;
  primaryFieldId: string;
  displayTitleFieldId?: string;
  entityPluralLabel: string;
  newLabel: string;
  editorLabels: Partial<EntryEditorLabels>;
};

export function HubEntityDashboard(props: HubEntityDashboardProps) {
  const { entryLocale, contentfulSpaceId, actions, contentTypeId, primaryFieldId, displayTitleFieldId, entityPluralLabel, newLabel, editorLabels } =
    props;
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
          contentTypeId={contentTypeId}
          entryLocale={entryLocale}
          managementApiRoot={HUB_MANAGEMENT_API}
          entityPluralLabel={entityPluralLabel}
          primaryFieldId={primaryFieldId}
          newLabel={newLabel}
          refreshLabel="Refresh"
          refreshingLabel="Refreshing…"
          onNew={goCreate}
          onEdit={goEdit}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <EntryEditor
            contentTypeId={contentTypeId}
            entryLocale={entryLocale}
            contentfulSpaceId={contentfulSpaceId}
            managementApiRoot={HUB_MANAGEMENT_API}
            actions={actions}
            mode={mode}
            entryId={selectedEntryId}
            displayTitleFieldId={displayTitleFieldId}
            onBack={goList}
            onCreated={(id) => {
              goEdit(id);
            }}
            labels={editorLabels}
          />
        </div>
      )}
    </div>
  );
}
