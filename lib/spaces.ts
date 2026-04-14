export const SPACES = ['art', 'design', 'hub'] as const;

export type SpaceId = (typeof SPACES)[number];

export function isSpaceId(value: string): value is SpaceId {
  return (SPACES as readonly string[]).includes(value);
}

export const SPACE_LABELS: Record<SpaceId, string> = {
  art: 'ART',
  design: 'DESIGN',
  hub: 'HUB',
};
