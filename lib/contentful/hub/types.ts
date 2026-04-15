import type { Asset, Entry } from 'contentful';

/**
 * Delivery payload for the primary HUB CV document (`resume` + resolved links).
 * Mirrors ART patterns: normalized entries + Contentful `includes` for link resolution.
 */
export type HubCvDeliveryResult = {
  items: Entry[];
  total: number;
  includes?: {
    Entry?: Entry[];
    Asset?: Asset[];
  };
};
