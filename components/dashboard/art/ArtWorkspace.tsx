'use client';

import * as React from 'react';
import { ArtDashboard, type ArtActions } from '@/components/dashboard/art/ArtDashboard';
import { NavigationGroupDashboard } from '@/components/dashboard/art/NavigationGroupDashboard';
import { CategoryDashboard } from '@/components/dashboard/art/CategoryDashboard';
import { TechDashboard } from '@/components/dashboard/art/TechDashboard';
import type { ArtModel } from '@/lib/art-models';
import { ART_MODEL_LABELS } from '@/lib/art-models';
import { ensureContentfulModelLoaded } from '@/lib/store/ensureContentfulModelLoaded';

export function ArtWorkspace(props: {
  entryLocale: string;
  contentfulSpaceId: string;
  actions: ArtActions;
  activeModel: ArtModel;
}) {
  const { entryLocale, contentfulSpaceId, actions, activeModel } = props;
  const [modelLoadError, setModelLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setModelLoadError(null);
    void ensureContentfulModelLoaded(activeModel).catch((e) => {
      if (!cancelled) {
        setModelLoadError(e instanceof Error ? e.message : 'Failed to load model');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeModel]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white px-0 pt-4">
      {modelLoadError ? (
        <p className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{modelLoadError}</p>
      ) : null}
      {activeModel === 'project' ? (
        <ArtDashboard entryLocale={entryLocale} contentfulSpaceId={contentfulSpaceId} actions={actions} />
      ) : activeModel === 'category' ? (
        <CategoryDashboard entryLocale={entryLocale} contentfulSpaceId={contentfulSpaceId} actions={actions} />
      ) : activeModel === 'navigationGroup' ? (
        <NavigationGroupDashboard entryLocale={entryLocale} contentfulSpaceId={contentfulSpaceId} actions={actions} />
      ) : activeModel === 'tech' ? (
        <TechDashboard entryLocale={entryLocale} contentfulSpaceId={contentfulSpaceId} actions={actions} />
      ) : (
        <div className="bg-white">
          <h2 className="text-base font-semibold text-neutral-900">{ART_MODEL_LABELS[activeModel]}</h2>
          <p className="mt-2 text-sm text-neutral-600">Coming soon.</p>
        </div>
      )}
    </div>
  );
}
