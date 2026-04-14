'use client';

import type { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import type { SpaceId } from '@/lib/spaces';

type DashboardLayoutProps = {
  activeSpace: SpaceId;
  onSpaceChange: (space: SpaceId) => void;
  children: ReactNode;
};

export function DashboardLayout({ activeSpace, onSpaceChange, children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen min-h-0 flex-col bg-neutral-100 text-neutral-900">
      <Navbar />
      <div className="flex min-h-0 flex-1">
        <Sidebar active={activeSpace} onChange={onSpaceChange} />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-6">
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </main>
      </div>
    </div>
  );
}
