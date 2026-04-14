'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { SpaceEmptyState } from '@/components/dashboard/SpaceEmptyState';
import { ArtUploaderDashboard } from '@/components/upload/ArtUploaderDashboard';
import type { SpaceId } from '@/lib/spaces';

export function AdminDashboard() {
  const [activeSpace, setActiveSpace] = useState<SpaceId>('art');

  return (
    <DashboardLayout activeSpace={activeSpace} onSpaceChange={setActiveSpace}>
      {activeSpace === 'art' ? (
        <ArtUploaderDashboard space={activeSpace} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {activeSpace === 'design' ? (
            <SpaceEmptyState space="design" />
          ) : (
            <SpaceEmptyState space="hub" />
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
