'use client';

import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { SpaceVisitHeader } from './SpaceVisitHeader';
import type { SpaceId } from '@/lib/spaces';
import type { DashboardHeaderTabs } from '@/lib/dashboard-header-tabs';

type DashboardLayoutProps = {
  activeSpace: SpaceId;
  onSpaceChange: (space: SpaceId) => void;
  onLogoClick?: (() => void) | null;
  /** Contentful space id for the active CMS tab (ART / HUB) — opens app.contentful.com */
  contentfulSpaceId?: string | null;
  /** Horizontal model tabs in the header (ART / HUB) */
  headerTabs?: DashboardHeaderTabs | null;
  /** Global refresh for the active tab/model */
  onRefresh?: (() => void) | null;
  refreshing?: boolean;
  children: ReactNode;
};

export function DashboardLayout({
  activeSpace,
  onSpaceChange,
  onLogoClick,
  contentfulSpaceId,
  headerTabs,
  onRefresh,
  refreshing,
  children,
}: DashboardLayoutProps) {
  return (
    <div className="flex h-screen min-h-0 flex-col bg-white text-neutral-900">
      <div className="flex min-h-0 flex-1 bg-white">
        <Sidebar active={activeSpace} onChange={onSpaceChange} onLogoClick={onLogoClick ?? undefined} />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white px-0 py-0">
          <SpaceVisitHeader
            activeSpace={activeSpace}
            contentfulSpaceId={contentfulSpaceId}
            headerTabs={headerTabs}
            onRefresh={onRefresh ?? undefined}
            refreshing={refreshing}
          />
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </main>
      </div>
    </div>
  );
}
