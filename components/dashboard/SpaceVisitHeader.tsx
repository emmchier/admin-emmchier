'use client';

import { ExternalLink } from 'lucide-react';
import type { SpaceId } from '@/lib/spaces';
import type { DashboardHeaderTabs } from '@/lib/dashboard-header-tabs';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
};

export function SpaceVisitHeader({ activeSpace, contentfulSpaceId, headerTabs }: SpaceVisitHeaderProps) {
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
    <header className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-neutral-200 px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center">
        {headerTabs ? (
          <Tabs value={headerTabs.active} onValueChange={headerTabs.onChange} className="min-w-0 flex-1">
            <TabsList
              variant="line"
              className="h-9 w-fit min-w-0 max-w-full justify-start gap-0 overflow-x-auto rounded-none bg-transparent p-0"
              aria-label={headerTabs.ariaLabel}
            >
              {headerTabs.items.map((item) => (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className="shrink-0 rounded-none px-3 py-2 text-sm data-active:after:bottom-0"
                >
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1">
        {contentfulBlock}
        {visitLink}
      </div>
    </header>
  );
}
