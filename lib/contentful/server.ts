import 'server-only';

import { createClient } from 'contentful-management';
import type { PlainClientAPI } from 'contentful-management';

type ContentfulServerEnv = {
  accessToken: string;
  spaceId: string;
  environmentId: string;
  entryLocale: string;
};

function readEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

export function getContentfulServerEnv(): ContentfulServerEnv {
  // Legacy env resolver (kept for backwards compatibility).
  // Prefer `artClients` / `hubClients` from `lib/contentful/clients.ts` for multi-space tokens.
  const accessToken = readEnv('CONTENTFUL_MANAGEMENT_TOKEN');
  const environmentId = readEnv('CONTENTFUL_ENVIRONMENT') ?? 'master';

  // Support either a generic space id or the existing multi-space keys.
  const spaceId =
    readEnv('CONTENTFUL_SPACE_ID') ??
    readEnv('CONTENTFUL_SPACE_ART_ID') ??
    readEnv('CONTENTFUL_SPACE_HUB_ID') ??
    readEnv('CONTENTFUL_SPACE_DESIGN_ID');

  if (!accessToken) throw new Error('Missing CONTENTFUL_MANAGEMENT_TOKEN');
  if (!spaceId) {
    throw new Error('Missing Contentful space id (CONTENTFUL_SPACE_ID or CONTENTFUL_SPACE_ART_ID)');
  }

  const entryLocale = readEnv('CONTENTFUL_ENTRY_LOCALE') ?? 'en-US';

  return { accessToken, spaceId, environmentId, entryLocale };
}

let cachedClient: PlainClientAPI | null = null;

export function getContentfulManagementClient(): PlainClientAPI {
  if (cachedClient) return cachedClient;
  const { accessToken } = getContentfulServerEnv();
  cachedClient = createClient({ accessToken });
  return cachedClient;
}

