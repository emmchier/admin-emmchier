import { cn } from '@/lib/utils';

/**
 * Selectable tech / catalogue chip — “Project”-style: `text-sm`, light fill + stroke, comfortable padding.
 */
export function cmsChipToggleClassName(selected: boolean) {
  return cn(
    'inline-flex max-w-[280px] cursor-pointer items-center truncate rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
    selected
      ? 'border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800'
      : 'border-neutral-300 bg-transparent text-neutral-900 hover:bg-neutral-100',
  );
}
