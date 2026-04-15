import 'server-only';

import { artClients } from '@/lib/contentful/clients';

/**
 * Contentful GraphQL (CDA) endpoint:
 * https://graphql.contentful.com/content/v1/spaces/{spaceId}/environments/{envId}
 */
function getGraphqlEndpoint(): string {
  const { spaceId, environmentId } = artClients;
  return `https://graphql.contentful.com/content/v1/spaces/${encodeURIComponent(spaceId)}/environments/${encodeURIComponent(environmentId)}`;
}

function requireDeliveryToken(): string {
  const token = process.env.CONTENTFUL_ART_DELIVERY_TOKEN?.trim();
  if (!token) throw new Error('Missing CONTENTFUL_ART_DELIVERY_TOKEN for Contentful GraphQL');
  return token;
}

type GraphqlError = { message: string; extensions?: unknown; locations?: unknown; path?: unknown };

type GraphqlResponse<T> = {
  data?: T;
  errors?: GraphqlError[];
};

async function contentfulGraphqlFetch<
  TData,
  TVars extends Record<string, unknown> = Record<string, unknown>,
>(args: {
  query: string;
  variables?: TVars;
}): Promise<TData> {
  const res = await fetch(getGraphqlEndpoint(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireDeliveryToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: args.query,
      variables: args.variables ?? {},
    }),
    cache: 'no-store',
  });

  const json = (await res.json()) as GraphqlResponse<TData> & { message?: string };
  if (!res.ok) {
    const msg =
      json?.errors?.[0]?.message ||
      json?.message ||
      `Contentful GraphQL failed (${res.status})`;
    throw new Error(msg);
  }
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }
  if (!json.data) {
    throw new Error('Contentful GraphQL returned no data');
  }
  return json.data;
}

/**
 * Shared sys fields used by the dashboard:
 * - `updatedAt`: list column
 * - `publishedAt` / `firstPublishedAt` / `publishedVersion` / `publishedCounter`: status badge
 */
const SYS_FIELDS = /* GraphQL */ `
  sys {
    id
    createdAt
    updatedAt
    publishedAt
    firstPublishedAt
    publishedVersion
    publishedCounter
  }
`;

// -----------------------------
// Queries (minimal, no overfetch)
// -----------------------------

/**
 * Initial load: projects list only (minimal fields for list + status + updated).
 */
export const getProjectsQuery = /* GraphQL */ `
  query getProjects($limit: Int!, $skip: Int!) {
    projectCollection(limit: $limit, skip: $skip, order: sys_updatedAt_DESC) {
      total
      items {
        ${SYS_FIELDS}
        title
        slug
      }
    }
  }
`;

export const getCategoriesQuery = /* GraphQL */ `
  query getCategories($limit: Int!, $skip: Int!) {
    categoryCollection(limit: $limit, skip: $skip, order: sys_updatedAt_DESC) {
      total
      items {
        ${SYS_FIELDS}
        title
        slug
        order
      }
    }
  }
`;

export const getNavigationGroupsQuery = /* GraphQL */ `
  query getNavigationGroups($limit: Int!, $skip: Int!) {
    navigationGroupCollection(limit: $limit, skip: $skip, order: sys_updatedAt_DESC) {
      total
      items {
        ${SYS_FIELDS}
        title
      }
    }
  }
`;

export const getTechsQuery = /* GraphQL */ `
  query getTechs($limit: Int!, $skip: Int!) {
    techCollection(limit: $limit, skip: $skip, order: sys_updatedAt_DESC) {
      total
      items {
        ${SYS_FIELDS}
        name
        slug
        order
      }
    }
  }
`;

// -----------------------------
// Fetch functions
// -----------------------------

type Sys = {
  id: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  publishedAt?: string | null;
  firstPublishedAt?: string | null;
  publishedVersion?: number | null;
  publishedCounter?: number | null;
};

export type ProjectGql = { sys: Sys; title?: string | null; slug?: string | null };
export type CategoryGql = { sys: Sys; title?: string | null; slug?: string | null; order?: number | null };
export type NavigationGroupGql = { sys: Sys; title?: string | null };
export type TechGql = { sys: Sys; name?: string | null; slug?: string | null; order?: number | null };

export async function fetchProjects(args: { limit?: number; skip?: number } = {}) {
  const limit = args.limit ?? 1000;
  const skip = args.skip ?? 0;

  return contentfulGraphqlFetch<{
    projectCollection: { total: number; items: Array<ProjectGql | null> };
  }>({
    query: getProjectsQuery,
    variables: { limit, skip },
  });
}

export async function fetchCategories(args: { limit?: number; skip?: number } = {}) {
  const limit = args.limit ?? 1000;
  const skip = args.skip ?? 0;

  return contentfulGraphqlFetch<{
    categoryCollection: { total: number; items: Array<CategoryGql | null> };
  }>({
    query: getCategoriesQuery,
    variables: { limit, skip },
  });
}

export async function fetchNavigationGroups(args: { limit?: number; skip?: number } = {}) {
  const limit = args.limit ?? 1000;
  const skip = args.skip ?? 0;

  return contentfulGraphqlFetch<{
    navigationGroupCollection: { total: number; items: Array<NavigationGroupGql | null> };
  }>({
    query: getNavigationGroupsQuery,
    variables: { limit, skip },
  });
}

export async function fetchTechs(args: { limit?: number; skip?: number } = {}) {
  const limit = args.limit ?? 1000;
  const skip = args.skip ?? 0;

  return contentfulGraphqlFetch<{
    techCollection: { total: number; items: Array<TechGql | null> };
  }>({
    query: getTechsQuery,
    variables: { limit, skip },
  });
}

