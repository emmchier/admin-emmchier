import 'server-only';

import type { PlainClientAPI } from 'contentful-management';
import type { ContentfulClients } from '@/lib/contentful/clients';
import { getEntryLocale } from '@/lib/contentful/clients';

export type ManagementRouteContext = {
  client: PlainClientAPI;
  spaceId: string;
  environmentId: string;
  entryLocale: string;
};

export function makeManagementCtx(clients: ContentfulClients): ManagementRouteContext {
  return {
    client: clients.managementClient,
    spaceId: clients.spaceId,
    environmentId: clients.environmentId,
    entryLocale: getEntryLocale(),
  };
}
