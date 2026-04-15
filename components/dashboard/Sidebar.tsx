'use client';

import { LogIn } from 'lucide-react';
import type { SpaceId } from '@/lib/spaces';
import { SPACE_LABELS, SPACES } from '@/lib/spaces';
import { Button } from '@/components/ui/button';

type SidebarProps = {
  active: SpaceId;
  onChange: (space: SpaceId) => void;
};

export function Sidebar({ active, onChange }: SidebarProps) {
  return (
    <aside className="flex min-h-0 w-52 shrink-0 flex-col border-r border-neutral-200 bg-white">
      <div className="shrink-0 px-4 pt-4">
        <p className="text-2xl font-black leading-tight tracking-tight text-neutral-900">emmchier.</p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-auto px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Spaces</p>
        <nav className="mt-3 flex flex-col gap-1" aria-label="Spaces">
          {SPACES.map((id) => {
            const isActive = id === active;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange(id)}
                className={`rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition ${
                  isActive
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-transparent text-neutral-700 hover:border-neutral-200 hover:bg-neutral-100'
                }`}
              >
                {SPACE_LABELS[id]}
              </button>
            );
          })}
        </nav>
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
