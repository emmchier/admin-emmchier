'use client';

import * as React from 'react';
import type { ArtActions } from '@/components/dashboard/art/ArtDashboard';
import type { HubTab } from '@/lib/hub-models';
import { HubResumeDashboard } from '@/components/dashboard/hub/HubResumeDashboard';
import { HubContactsDashboard } from '@/components/dashboard/hub/HubContactsDashboard';

export function HubWorkspace(props: {
  entryLocale: string;
  contentfulSpaceId: string;
  actions: ArtActions;
  activeTab: HubTab;
}) {
  const { entryLocale, contentfulSpaceId, actions, activeTab } = props;

  if (activeTab === 'resume') {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-white px-0 pt-0">
        <HubResumeDashboard entryLocale={entryLocale} contentfulSpaceId={contentfulSpaceId} actions={actions} />
      </div>
    );
  }

  if (activeTab === 'contacts') {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-white px-0 pt-0">
        <HubContactsDashboard entryLocale={entryLocale} contentfulSpaceId={contentfulSpaceId} actions={actions} />
      </div>
    );
  }

  return null;
}
