'use client';

import * as React from 'react';
import type { EntryEditorLabels } from '@/components/cms/EntryEditor';
import { EntryList } from '@/components/cms/EntryList';
import type { ArtActions } from '@/components/dashboard/art/ArtDashboard';
import { HubEntrySideSheet } from '@/components/dashboard/hub/HubEntrySideSheet';

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
  const [listVersion, setListVersion] = React.useState(0);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [sheetMode, setSheetMode] = React.useState<'create' | 'edit'>('create');
  const [sheetEntryId, setSheetEntryId] = React.useState<string | null>(null);

  const openCreate = React.useCallback(() => {
    setSheetMode('create');
    setSheetEntryId(null);
    setSheetOpen(true);
  }, []);

  const openEdit = React.useCallback((id: string) => {
    setSheetMode('edit');
    setSheetEntryId(id);
    setSheetOpen(true);
  }, []);

  const sheetTitle = React.useMemo(() => {
    const trimmed = (newLabel || '').trim();
    if (sheetMode === 'create') return trimmed || `New ${entityPluralLabel}`;
    const base = trimmed.toLowerCase().startsWith('new ') ? trimmed.slice(4).trim() : entityPluralLabel;
    return `Edit ${base || entityPluralLabel}`;
  }, [entityPluralLabel, newLabel, sheetMode]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0">
      <EntryList
        key={`${contentTypeId}-${listVersion}`}
        contentTypeId={contentTypeId}
        entryLocale={entryLocale}
        managementApiRoot={HUB_MANAGEMENT_API}
        entityPluralLabel={entityPluralLabel}
        primaryFieldId={primaryFieldId}
        newLabel={newLabel}
        refreshLabel="Refresh"
        refreshingLabel="Refreshing…"
        onNew={openCreate}
        onEdit={openEdit}
      />

      <HubEntrySideSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setListVersion((v) => v + 1);
        }}
        title={sheetTitle}
        entryLocale={entryLocale}
        contentfulSpaceId={contentfulSpaceId}
        actions={actions}
        contentTypeId={contentTypeId}
        displayTitleFieldId={displayTitleFieldId}
        mode={sheetMode}
        entryId={sheetEntryId}
        labels={editorLabels}
        onMutated={() => setListVersion((v) => v + 1)}
        onCreated={(id) => {
          setSheetMode('edit');
          setSheetEntryId(id);
          setListVersion((v) => v + 1);
        }}
      />
    </div>
  );
}
