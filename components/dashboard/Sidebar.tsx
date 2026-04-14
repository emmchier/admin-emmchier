'use client';

import type { SpaceId } from '@/lib/spaces';
import { SPACE_LABELS, SPACES } from '@/lib/spaces';

type SidebarProps = {
  active: SpaceId;
  onChange: (space: SpaceId) => void;
};

export function Sidebar({ active, onChange }: SidebarProps) {
  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-neutral-200 bg-white">
      <div className="px-4 py-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Spaces</p>
        <nav className="mt-3 flex flex-col gap-1" aria-label="Spaces">
          {SPACES.map((id) => {
            const isActive = id === active;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange(id)}
                className={`rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition ${
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
    </aside>
  );
}
