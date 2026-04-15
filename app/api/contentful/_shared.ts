import { artClients } from '@/lib/contentful/clients';
import { jsonError, jsonOk, parseIntParam } from '@/lib/contentful/http';
import { makeManagementCtx } from '@/lib/contentful/managementContext';

export const runtime = 'nodejs';

export { jsonOk, jsonError, parseIntParam };

export function getCtx() {
  return makeManagementCtx(artClients);
}
