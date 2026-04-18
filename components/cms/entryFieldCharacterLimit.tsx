'use client';

import { cn } from '@/lib/utils';

/** Short text fields (title, slug, Symbol, Text) in schema-driven forms */
export const ENTRY_FIELD_CHAR_LIMIT = 256;

export function clampEntryFieldString(
  value: string,
  max = ENTRY_FIELD_CHAR_LIMIT,
): string {
  return value.length <= max ? value : value.slice(0, max);
}

export function EntryFieldCharacterFooter(props: {
  length: number;
  max?: number;
  className?: string;
}) {
  const max = props.max ?? ENTRY_FIELD_CHAR_LIMIT;
  return (
    <div
      className={cn(
        'flex justify-between gap-3 text-xs text-neutral-500',
        props.className,
      )}
    >
      <span>{props.length} caracteres</span>
      <span>Máximo {max} caracteres</span>
    </div>
  );
}
