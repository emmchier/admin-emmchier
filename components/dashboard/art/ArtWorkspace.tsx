'use client';

import * as React from 'react';
import { ArtDashboard, type ArtActions } from '@/components/dashboard/art/ArtDashboard';
import { NavigationGroupDashboard } from '@/components/dashboard/art/NavigationGroupDashboard';
import { CategoryDashboard } from '@/components/dashboard/art/CategoryDashboard';
import type { ArtModel } from '@/lib/art-models';
import { ART_MODEL_LABELS } from '@/lib/art-models';

export function ArtWorkspace(props: {
  entryLocale: string;
  contentfulSpaceId: string;
  actions: ArtActions;
  activeModel: ArtModel;
}) {
  const { entryLocale, contentfulSpaceId, actions, activeModel } = props;

  // Tech is internal-only in ART (Project form uses it), so normalize away any accidental "tech" navigation.
  const navigableModel: Exclude<ArtModel, 'tech'> = activeModel === 'tech' ? 'project' : activeModel;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white px-0 pt-0">
      {navigableModel === 'project' ? (
        <ArtDashboard entryLocale={entryLocale} contentfulSpaceId={contentfulSpaceId} actions={actions} />
      ) : navigableModel === 'category' ? (
        <CategoryDashboard entryLocale={entryLocale} contentfulSpaceId={contentfulSpaceId} actions={actions} />
      ) : navigableModel === 'navigationGroup' ? (
        <NavigationGroupDashboard entryLocale={entryLocale} contentfulSpaceId={contentfulSpaceId} actions={actions} />
      ) : (
        <div className="bg-white">
          <h2 className="text-base font-semibold text-neutral-900">{ART_MODEL_LABELS[navigableModel]}</h2>
          <p className="mt-2 text-sm text-neutral-600">Coming soon.</p>
        </div>
      )}
    </div>
  );
}
