'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';

export type EntryStatus = 'published' | 'draft';

function inferEntryStatus(entry: any): EntryStatus {
  // Contentful:
  // - `sys.publishedAt` exists ONLY when the entry is currently published
  // - `sys.firstPublishedAt` may exist even after unpublishing
  return entry?.sys?.publishedAt ? 'published' : 'draft';
}

export function StatusBadge(props: { entry: any; className?: string }) {
  const { entry, className } = props;
  const status = React.useMemo(() => inferEntryStatus(entry), [entry]);

  if (status === 'published') {
    return (
      <Badge className={className} variant="success">
        Published
      </Badge>
    );
  }

  return (
    <Badge className={className} variant="warning">
      Draft
    </Badge>
  );
}

