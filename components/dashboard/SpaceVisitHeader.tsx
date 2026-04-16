'use client';

import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import type { SpaceId } from '@/lib/spaces';
import type { DashboardHeaderTabs } from '@/lib/dashboard-header-tabs';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

const VISIT: Record<SpaceId, { href: string; host: string }> = {
  art: { href: 'https://art.emmchier.com', host: 'art.emmchier.com' },
  design: { href: 'https://design.emmchier.com', host: 'design.emmchier.com' },
  hub: { href: 'https://emmchier.com', host: 'emmchier.com' },
};

export type SpaceVisitHeaderProps = {
  activeSpace: SpaceId;
  /** Contentful space id when ART or HUB is active */
  contentfulSpaceId?: string | null;
  /** Horizontal tabs (ART models, HUB sections) */
  headerTabs?: DashboardHeaderTabs | null;
  /** Single global refresh for active tab/model */
  onRefresh?: () => void;
  refreshing?: boolean;
};

export function SpaceVisitHeader({ activeSpace, contentfulSpaceId, headerTabs, onRefresh, refreshing }: SpaceVisitHeaderProps) {
  const v = VISIT[activeSpace];
  const cfHref =
    (activeSpace === 'art' || activeSpace === 'hub') && contentfulSpaceId?.trim()
      ? `https://app.contentful.com/spaces/${encodeURIComponent(contentfulSpaceId.trim())}/`
      : null;

  const visitLink = (
    <p className="m-0 text-sm text-neutral-700">
      <span>Visit </span>
      <a
        href={v.href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-900"
      >
        {v.host}
        <ExternalLink className="size-3.5 shrink-0" aria-hidden />
      </a>
    </p>
  );

  const contentfulBlock = (
    <div className="text-sm">
      {cfHref ? (
        <a
          href={cfHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-900"
        >
          Go to contentful space
          <ExternalLink className="size-3.5 shrink-0" aria-hidden />
        </a>
      ) : (
        <span className="text-neutral-400">Go to contentful space</span>
      )}
    </div>
  );

  return (
    <header className="flex h-14 w-full items-stretch justify-between gap-x-4 border-b border-neutral-200 px-4 py-0">
      <div className="flex min-w-0 flex-1 items-stretch">
        {headerTabs ? (
          <Tabs
            value={headerTabs.active}
            onValueChange={headerTabs.onChange}
            className="min-w-0 flex-1 data-horizontal:flex-row data-horizontal:items-stretch data-horizontal:gap-0"
          >
            <TabsList
              variant="line"
              className="h-full! w-fit min-w-0 max-w-full items-stretch justify-start gap-0 overflow-x-auto rounded-none bg-transparent p-0!"
              aria-label={headerTabs.ariaLabel}
            >
              {headerTabs.items.map((item) => {
                const isActive = item.value === headerTabs.active;
                return (
                  <TabsTrigger
                    key={item.value}
                    value={item.value}
                    aria-disabled={isActive}
                    className={[
                      'h-full! shrink-0 rounded-none px-3 py-0! text-[20px] font-medium leading-none',
                      isActive ? 'cursor-default pointer-events-none text-neutral-900 font-semibold opacity-100 aria-disabled:opacity-100' : '',
                    ].join(' ')}
                  >
                    {item.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-x-4">
        {onRefresh ? (
          <Button type="button" variant="outline" size="icon" onClick={onRefresh} disabled={Boolean(refreshing)}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="sr-only">Refresh</span>
          </Button>
        ) : null}
        {contentfulBlock}
        {visitLink}
      </div>
    </header>
  );
}
