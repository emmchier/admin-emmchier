/**
 * HUB Contentful service layer (Delivery + Management).
 * Mirrors ART integration style: space-scoped clients from `hubClients`, typed helpers.
 *
 * Env: `CONTENTFUL_SPACE_HUB_ID`, `CONTENTFUL_HUB_DELIVERY_TOKEN`, `CONTENTFUL_HUB_MANAGEMENT_TOKEN`, `CONTENTFUL_ENVIRONMENT`.
 */
export {
  hubDeliveryGetEntries,
  hubDeliveryGetEntriesNormalized,
  hubFetchEntries,
  getHubCv,
  fetchHubResumeDeliveryCollection,
} from '@/lib/contentful/hub/delivery';
export type { HubDeliveryFetchArgs, HubDeliveryIncludeDepth } from '@/lib/contentful/hub/delivery';

export { getHubCV } from '@/lib/contentful/hub/getHubCV';
export type {
  HubCVPayload,
  HubCVProfileImage,
  HubCVExperience,
  HubCVCourse,
  HubCVStudy,
  HubCVLanguage,
  HubCVContact,
  HubCVSocialNetwork,
} from '@/lib/contentful/hub/hubCvTypes';

export { hubCreateEntry, hubUpdateEntry, hubDeleteEntry, hubPublishEntry, hubUnpublishEntry } from '@/lib/contentful/hub/management';

export { HUB_DELIVERY_CONTENT_TYPES, HUB_DELIVERY_CONTENT_TYPE_SET } from '@/lib/contentful/hub/constants';
export type { HubDeliveryContentType } from '@/lib/contentful/hub/constants';

export type { HubCvDeliveryResult } from '@/lib/contentful/hub/types';
