'use client';

import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { SpaceVisitHeader } from './SpaceVisitHeader';
import type { SpaceId } from '@/lib/spaces';
import type { DashboardHeaderTabs } from '@/lib/dashboard-header-tabs';

type DashboardLayoutProps = {
  activeSpace: SpaceId;
  onSpaceChange: (space: SpaceId) => void;
  /** Contentful space id for the active CMS tab (ART / HUB) — opens app.contentful.com */
  contentfulSpaceId?: string | null;
  /** Horizontal model tabs in the header (ART / HUB) */
  headerTabs?: DashboardHeaderTabs | null;
  children: ReactNode;
};

export function DashboardLayout({
  activeSpace,
  onSpaceChange,
  contentfulSpaceId,
  headerTabs,
  children,
}: DashboardLayoutProps) {
  return (
    <div className="flex h-screen min-h-0 flex-col bg-white text-neutral-900">
      <div className="flex min-h-0 flex-1 bg-white">
        <Sidebar active={activeSpace} onChange={onSpaceChange} />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white px-0 py-0">
          <SpaceVisitHeader activeSpace={activeSpace} contentfulSpaceId={contentfulSpaceId} headerTabs={headerTabs} />
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </main>
      </div>
    </div>
  );
}
