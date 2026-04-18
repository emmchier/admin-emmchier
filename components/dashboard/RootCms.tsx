'use client';

import * as React from 'react';
import { ArtWorkspace } from '@/components/dashboard/art/ArtWorkspace';
import type { ArtActions } from '@/components/dashboard/art/ArtDashboard';
import { HubWorkspace } from '@/components/dashboard/hub/HubWorkspace';
import { Toaster } from '@/components/ui/toaster';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import type { SpaceId } from '@/lib/spaces';
import type { ArtModel } from '@/lib/art-models';
import { ART_MODEL_LABELS, ART_MODELS } from '@/lib/art-models';
import type { HubTab } from '@/lib/hub-models';
import { HUB_TAB_LABELS, HUB_TABS } from '@/lib/hub-models';
import type { DashboardHeaderTabs } from '@/lib/dashboard-header-tabs';
import { toast } from '@/lib/ui/snackbar';
import { contentfulService } from '@/services/contentfulService';
import { useProjectUnsavedNavigationGuard } from '@/lib/stores/projectUnsavedNavigationGuard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export type RootCmsProps = {
  entryLocale: string;
  artSpaceId: string;
  hubSpaceId: string;
  artActions: ArtActions;
  hubActions: ArtActions;
};

export function RootCms(props: RootCmsProps) {
  const { entryLocale, artSpaceId, hubSpaceId, artActions, hubActions } = props;
  const [activeSpace, setActiveSpace] = React.useState<SpaceId>('art');
  const [artModel, setArtModel] = React.useState<ArtModel>('project');
  const [hubTab, setHubTab] = React.useState<HubTab>('contacts');
  const [refreshing, setRefreshing] = React.useState(false);

  const bootLoadedRef = React.useRef(false);

  const requestNavigate = useProjectUnsavedNavigationGuard((s) => s.requestNavigate);
  const unsavedModalOpen = useProjectUnsavedNavigationGuard((s) => s.modalOpen);
  const confirmDiscardUnsaved = useProjectUnsavedNavigationGuard((s) => s.confirmDiscard);
  const cancelDiscardUnsaved = useProjectUnsavedNavigationGuard((s) => s.cancelDiscard);

  const loadArtModel = React.useCallback(async (model: ArtModel, opts?: { force?: boolean }) => {
    const force = Boolean(opts?.force);
    if (model === 'tech') return; // internal-only
    const contentTypeId = model === 'project' ? 'project' : model === 'category' ? 'category' : 'navigationGroup';
    await contentfulService.getEntriesCached({ space: 'art', contentTypeId, force });
  }, []);

  const loadHubTab = React.useCallback(async (tab: HubTab, opts?: { force?: boolean }) => {
    const force = Boolean(opts?.force);
    if (tab === 'contacts') {
      await contentfulService.getEntriesCached({ space: 'hub', contentTypeId: 'contact', force });
      return;
    }
    if (tab === 'resume') {
      // Resume dashboard needs the resume entry + experiences; other sections load on demand.
      await Promise.all([
        contentfulService.getEntriesCached({ space: 'hub', contentTypeId: 'resume', force }),
        contentfulService.getEntriesCached({ space: 'hub', contentTypeId: 'experience', force }),
      ]);
    }
  }, []);

  const changeArtModel = React.useCallback(
    (next: ArtModel) => {
      setArtModel(next);
      void loadArtModel(next);
    },
    [loadArtModel],
  );

  const changeHubTab = React.useCallback(
    (next: HubTab) => {
      setHubTab(next);
      void loadHubTab(next);
    },
    [loadHubTab],
  );

  const navigateSpace = React.useCallback(
    (next: SpaceId) => {
      setActiveSpace(next);
      if (next === 'art') void loadArtModel(artModel);
      if (next === 'hub') void loadHubTab(hubTab);
    },
    [artModel, hubTab, loadArtModel, loadHubTab],
  );

  const runRefresh = React.useCallback(() => {
    if (refreshing) return;
    setRefreshing(true);
    (async () => {
      try {
        if (activeSpace === 'art') {
          await loadArtModel(artModel, { force: true });
          toast.success('Updated');
          return;
        }
        if (activeSpace === 'hub') {
          if (hubTab === 'contacts') {
            await loadHubTab('contacts', { force: true });
            toast.success('Updated');
            return;
          }
          if (hubTab === 'resume') {
            await loadHubTab('resume', { force: true });
            toast.success('Updated');
            return;
          }
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to refresh');
      } finally {
        setRefreshing(false);
      }
    })();
  }, [activeSpace, artModel, hubTab, loadArtModel, loadHubTab, refreshing]);

  const onLogoClick = React.useCallback(() => {
    requestNavigate(() => {
      setActiveSpace('art');
      setArtModel('project');
    });
  }, [requestNavigate]);

  // One-time initial load (Zustand-first). No useEffect fetching.
  if (!bootLoadedRef.current) {
    bootLoadedRef.current = true;
    void loadArtModel('project');
  }

  const headerTabs: DashboardHeaderTabs | null = React.useMemo(() => {
    if (activeSpace === 'art') {
      return {
        active: artModel,
        onChange: (v) => requestNavigate(() => changeArtModel(v as ArtModel)),
        items: ART_MODELS.map((m) => ({ value: m, label: ART_MODEL_LABELS[m] })),
        ariaLabel: 'ART content types',
      };
    }
    if (activeSpace === 'hub') {
      return {
        active: hubTab,
        onChange: (v) => requestNavigate(() => changeHubTab(v as HubTab)),
        items: HUB_TABS.map((t) => ({ value: t, label: HUB_TAB_LABELS[t] })),
        ariaLabel: 'HUB CV and content types',
      };
    }
    return null;
  }, [activeSpace, artModel, hubTab, requestNavigate, changeArtModel, changeHubTab]);

  const contentfulSpaceId = activeSpace === 'art' ? artSpaceId : activeSpace === 'hub' ? hubSpaceId : null;

  const onRefreshGuarded = React.useCallback(() => {
    requestNavigate(runRefresh);
  }, [requestNavigate, runRefresh]);

  const onSpaceChange = React.useCallback(
    (next: SpaceId) => requestNavigate(() => navigateSpace(next)),
    [requestNavigate, navigateSpace],
  );

  return (
    <DashboardLayout
      activeSpace={activeSpace}
      onSpaceChange={onSpaceChange}
      onLogoClick={onLogoClick}
      contentfulSpaceId={contentfulSpaceId}
      headerTabs={headerTabs}
      onRefresh={activeSpace === 'design' ? null : onRefreshGuarded}
      refreshing={refreshing}
    >
      {activeSpace === 'art' ? (
        <ArtWorkspace entryLocale={entryLocale} contentfulSpaceId={artSpaceId} actions={artActions} activeModel={artModel} />
      ) : activeSpace === 'hub' ? (
        <HubWorkspace entryLocale={entryLocale} contentfulSpaceId={hubSpaceId} actions={hubActions} activeTab={hubTab} />
      ) : (
        <div className="bg-white px-0 pt-0 pb-0">
          <h2 className="text-base font-semibold text-neutral-900">DESIGN</h2>
          <p className="mt-2 text-sm text-neutral-600">Coming soon.</p>
        </div>
      )}

      <AlertDialog open={unsavedModalOpen} onOpenChange={(open) => !open && cancelDiscardUnsaved()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved project changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved edits to this project. If you continue, they will be discarded (same as Revert). This cannot be undone from here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDiscardUnsaved}>Stay</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-600/90 focus-visible:ring-amber-600"
              onClick={(e) => {
                e.preventDefault();
                confirmDiscardUnsaved();
              }}
            >
              Discard and continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </DashboardLayout>
  );
}
