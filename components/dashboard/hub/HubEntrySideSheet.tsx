'use client';

import * as React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { EntryEditor, type EntryEditorLabels, type EntryEditorMode } from '@/components/cms/EntryEditor';
import type { ArtActions } from '@/components/dashboard/art/ArtDashboard';

const HUB_MANAGEMENT_API = '/api/contentful/hub';

export type HubEntrySideSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  entryLocale: string;
  contentfulSpaceId: string;
  actions: ArtActions;
  contentTypeId: string;
  displayTitleFieldId?: string;
  mode: EntryEditorMode;
  entryId: string | null;
  labels: Partial<EntryEditorLabels>;
  /** Called after create/delete to let the list refresh (optional). */
  onMutated?: () => void;
  /** Called when the entry is created (optional). */
  onCreated?: (id: string) => void;
};

export function HubEntrySideSheet(props: HubEntrySideSheetProps) {
  const {
    open,
    onOpenChange,
    title,
    entryLocale,
    contentfulSpaceId,
    actions,
    contentTypeId,
    displayTitleFieldId,
    mode,
    entryId,
    labels,
    onMutated,
    onCreated,
  } = props;

  const wrappedActions = React.useMemo<ArtActions>(() => {
    const ping = () => onMutated?.();
    return {
      createEntryAction: async (args) => {
        const res = await actions.createEntryAction(args);
        return res;
      },
      updateEntryAction: async (args) => {
        const res = await actions.updateEntryAction(args);
        ping();
        return res;
      },
      deleteEntryAction: async (entryId) => {
        const res = await actions.deleteEntryAction(entryId);
        ping();
        return res;
      },
      publishEntryAction: async (entryId) => {
        const res = await actions.publishEntryAction(entryId);
        ping();
        return res;
      },
      unpublishEntryAction: async (entryId) => {
        const res = await actions.unpublishEntryAction(entryId);
        ping();
        return res;
      },
    };
  }, [actions, onMutated]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl">
        <SheetHeader className="shrink-0 border-b border-neutral-200">
          <SheetTitle className="text-base">{title}</SheetTitle>
        </SheetHeader>
        <div className="flex h-full min-h-0 flex-1 flex-col">
          <EntryEditor
            contentTypeId={contentTypeId}
            entryLocale={entryLocale}
            contentfulSpaceId={contentfulSpaceId}
            managementApiRoot={HUB_MANAGEMENT_API}
            actions={wrappedActions}
            mode={mode}
            entryId={entryId}
            displayTitleFieldId={displayTitleFieldId}
            onBack={() => onOpenChange(false)}
            onCreated={(id) => {
              onMutated?.();
              onCreated?.(id);
            }}
            labels={labels}
            onConfirmDelete={async ({ entryId: deletingId }) => {
              await wrappedActions.deleteEntryAction(deletingId);
              onMutated?.();
              onOpenChange(false);
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

