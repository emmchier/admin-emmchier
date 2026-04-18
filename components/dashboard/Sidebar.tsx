'use client';

import { LogIn } from 'lucide-react';
import type { SpaceId } from '@/lib/spaces';
import { SPACE_LABELS, SPACES } from '@/lib/spaces';
import { Button } from '@/components/ui/button';

type SidebarProps = {
  active: SpaceId;
  onChange: (space: SpaceId) => void;
  onLogoClick?: () => void;
};

export function Sidebar({ active, onChange, onLogoClick }: SidebarProps) {
  return (
    <aside className="flex min-h-0 w-60 shrink-0 flex-col border-r border-neutral-200 bg-white">
      <div className="shrink-0 px-4 pt-4">
        <button
          type="button"
          onClick={() => (onLogoClick ? onLogoClick() : onChange('art'))}
          className="text-2xl font-black leading-tight tracking-tight text-neutral-900"
          aria-label="Go to ART"
        >
          emmchier.
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-auto py-4">
        <div className="px-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Spaces</p>
        <nav className="mt-4 flex flex-col gap-3" aria-label="Spaces">
          {SPACES.map((id) => {
            const isActive = id === active;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  if (isActive) return;
                  onChange(id);
                }}
                disabled={isActive}
                className={[
                  'text-left font-black uppercase leading-none transition',
                  'text-[40px]',
                  isActive
                    ? 'text-neutral-900'
                    : 'text-transparent [-webkit-text-stroke:1px_#0a0a0a] hover:text-neutral-900 hover:[-webkit-text-stroke:0px_transparent]',
                  isActive ? 'cursor-default' : 'cursor-pointer',
                ].join(' ')}
              >
                {String(SPACE_LABELS[id] ?? id).toUpperCase()}
              </button>
            );
          })}
        </nav>
        </div>
      </div>

      <div className="shrink-0 border-t border-neutral-200 px-4 py-4">
        <Button type="button" variant="outline" className="w-full justify-center gap-2 rounded-lg">
          <LogIn className="h-4 w-4" aria-hidden />
          Login
        </Button>
      </div>
    </aside>
  );
}
