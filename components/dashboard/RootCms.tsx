'use client';

import * as React from 'react';
import { ArtWorkspace } from '@/components/dashboard/art/ArtWorkspace';
import type { ArtActions } from '@/components/dashboard/art/ArtDashboard';
import { HubWorkspace } from '@/components/dashboard/hub/HubWorkspace';
import { Toaster } from '@/components/ui/sonner';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import type { SpaceId } from '@/lib/spaces';
import type { ArtModel } from '@/lib/art-models';
import { ART_MODEL_LABELS, ART_MODELS } from '@/lib/art-models';
import type { HubTab } from '@/lib/hub-models';
import { HUB_TAB_LABELS, HUB_TABS } from '@/lib/hub-models';
import type { DashboardHeaderTabs } from '@/lib/dashboard-header-tabs';

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
  const [hubTab, setHubTab] = React.useState<HubTab>('cv');

  const headerTabs: DashboardHeaderTabs | null = React.useMemo(() => {
    if (activeSpace === 'art') {
      return {
        active: artModel,
        onChange: (v) => setArtModel(v as ArtModel),
        items: ART_MODELS.map((m) => ({ value: m, label: ART_MODEL_LABELS[m] })),
        ariaLabel: 'ART content types',
      };
    }
    if (activeSpace === 'hub') {
      return {
        active: hubTab,
        onChange: (v) => setHubTab(v as HubTab),
        items: HUB_TABS.map((t) => ({ value: t, label: HUB_TAB_LABELS[t] })),
        ariaLabel: 'HUB CV and content types',
      };
    }
    return null;
  }, [activeSpace, artModel, hubTab]);

  const contentfulSpaceId = activeSpace === 'art' ? artSpaceId : activeSpace === 'hub' ? hubSpaceId : null;

  return (
    <DashboardLayout
      activeSpace={activeSpace}
      onSpaceChange={setActiveSpace}
      contentfulSpaceId={contentfulSpaceId}
      headerTabs={headerTabs}
    >
      {activeSpace === 'art' ? (
        <ArtWorkspace entryLocale={entryLocale} contentfulSpaceId={artSpaceId} actions={artActions} activeModel={artModel} />
      ) : activeSpace === 'hub' ? (
        <HubWorkspace entryLocale={entryLocale} contentfulSpaceId={hubSpaceId} actions={hubActions} activeTab={hubTab} />
      ) : (
        <div className="bg-white px-0 pt-4 pb-0">
          <h2 className="text-base font-semibold text-neutral-900">DESIGN</h2>
          <p className="mt-2 text-sm text-neutral-600">Coming soon.</p>
        </div>
      )}

      <Toaster position="bottom-left" />
    </DashboardLayout>
  );
}
