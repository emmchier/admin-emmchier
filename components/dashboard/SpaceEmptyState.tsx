import { SPACE_LABELS, type SpaceId } from '@/lib/spaces';

type SpaceEmptyStateProps = {
  space: Exclude<SpaceId, 'art'>;
};

export function SpaceEmptyState({ space }: SpaceEmptyStateProps) {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center">
      <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
        {SPACE_LABELS[space]}
      </h1>
      <p className="mt-3 max-w-sm text-sm text-neutral-500">Coming soon</p>
    </div>
  );
}
