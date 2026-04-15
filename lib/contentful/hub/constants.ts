/**
 * HUB space: allowed `content_type` values for Delivery reads (published entries).
 * Keep aligned with `docs/hub-content-model.json`.
 */
export const HUB_DELIVERY_CONTENT_TYPES = [
  'contact',
  'course',
  'experience',
  'language',
  'resume',
  'socialNetwork',
  'study',
  'tech',
] as const;

export type HubDeliveryContentType = (typeof HUB_DELIVERY_CONTENT_TYPES)[number];

export const HUB_DELIVERY_CONTENT_TYPE_SET = new Set<string>(HUB_DELIVERY_CONTENT_TYPES);
