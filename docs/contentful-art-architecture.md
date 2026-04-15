# Contentful ART integration architecture (emmchier-admin)

This document describes **how the ART space is integrated with Contentful** in this repository: where clients are created, how environment variables are handled, how read/write services are organized, how data is modeled/normalized, and how it flows into the UI. It also summarizes the current caching/request-optimization strategy and reusable patterns.

---

## 1) Connection structure (clients + env)

### Management API (CMA) client

- **Client creation**: `lib/contentful/server.ts`
  - `getContentfulManagementClient()` creates a `contentful-management` client via `createClient({ accessToken })`.
  - The client is **singleton-cached in module scope** (`cachedClient`) to avoid re-instantiation.

- **Environment resolution**: `getContentfulServerEnv()` in the same file
  - Reads:
    - `CONTENTFUL_MANAGEMENT_TOKEN` (required)
    - `CONTENTFUL_ENVIRONMENT` (optional, default `master`)
    - `CONTENTFUL_SPACE_ID` (optional) OR the first available of:
      - `CONTENTFUL_SPACE_ART_ID`
      - `CONTENTFUL_SPACE_HUB_ID`
      - `CONTENTFUL_SPACE_DESIGN_ID`
    - `CONTENTFUL_ENTRY_LOCALE` (optional, default `en-US`)

**Important**: This is a **server-only module** (`import 'server-only'`) and should never be imported into client components.

### Delivery API (CDA) client (REST)

- **Client creation**: `app/api/contentful/delivery/entries/route.ts`
  - Uses the `contentful` SDK (`createClient({ space, environment, accessToken })`).
  - Requires `CONTENTFUL_DELIVERY_TOKEN`.
  - Uses `getContentfulServerEnv()` to derive `{ spaceId, environmentId }`.

- **Endpoint**: `GET /api/contentful/delivery/entries?contentType=...&limit=...`
  - Restricts `contentType` to: `project`, `category`, `navigationGroup`, `tech`.
  - Returns `items` and `total`.

### GraphQL (CDA) module (prepared)

- **Module**: `lib/contentful/graphql.ts` (server-only)
  - GraphQL endpoint shape:
    - `https://graphql.contentful.com/content/v1/spaces/{spaceId}/environments/{envId}`
  - Uses `CONTENTFUL_DELIVERY_TOKEN` for auth.
  - Defines minimal queries and fetch helpers:
    - `getProjectsQuery`, `getCategoriesQuery`, `getNavigationGroupsQuery`, `getTechsQuery`
    - `fetchProjects`, `fetchCategories`, `fetchNavigationGroups`, `fetchTechs`

**Status**: this module exists as a reusable foundation; the current on-demand loader is still wired to the REST delivery route.

---

## 2) Service organization (fetch + CRUD + naming)

### Delivery (read) services

#### On-demand model loader

- **File**: `lib/store/ensureContentfulModelLoaded.ts`
- **Responsibility**:
  - Given a model name (`project | category | navigationGroup | tech`):
    - Check Zustand (`isModelLoaded(model)`)
    - If not loaded, fetch the delivery REST route for that content type
    - Normalize entries (see normalization section)
    - Store into Zustand maps (`setProjects`, `setCategories`, etc.)
  - Dedupe concurrent requests via an in-memory `inflight` `Map`.

**Naming**:
- `ensureXLoaded(...)` implies:
  - it can be called repeatedly
  - it will only fetch if required
  - it dedupes concurrent calls

### Management (write) services

#### Server actions for ART CRUD

- **File**: `app/dashboard/art/actions.ts`
- **Entry lifecycle**:
  - `createEntryAction`: validates field IDs against the content type schema, localizes values, creates entry.
  - `updateEntryAction`: fetches the existing entry, merges localized fields, updates entry.
  - `deleteEntryAction`: deletes entry.
  - `publishEntryAction` / `unpublishEntryAction`: fetches entry then publishes/unpublishes.
- Uses Next.js `revalidatePath()` to invalidate server caches for `/dashboard/art` and detail path.

**Naming conventions**:
- `*Action` suffix indicates **server actions** used from client components.
- `create/update/delete/publish/unpublish` mirror Contentful lifecycle.
- “Allowed fields” logic is centralized in `allowedFieldIds(...)` + `filterToContentTypeFields(...)`.

#### Management API routes (read helpers)

- **Routes**: `app/api/contentful/*`
  - These routes wrap CMA and provide JSON responses to the client UI:
    - `GET /api/contentful/content-types`
    - `GET /api/contentful/entries` (list)
    - `GET /api/contentful/entries/[id]` (detail)
    - plus publish/unpublish routes, asset preview routes, etc.

**Current usage**:
- The editor still uses CMA routes for:
  - content type schema (`/api/contentful/content-types`)
  - fallback detail fetch (`/api/contentful/entries/[id]`) when not sufficiently cached.

---

## 3) Data modeling (types + normalization)

### Types / interfaces

- **Generated types**: `types/contentful.ts`
  - `ContentTypeId` union: `'tech' | 'imageAsset' | 'project' | 'navigationGroup' | 'category'`
  - Field interfaces: `Project`, `Category`, `NavigationGroup`, `Tech`, `ImageAsset`
  - Generic entry type:
    - `Entry<T>` contains:
      - `sys` metadata (id, contentType, timestamps, publishedAt)
      - `fields` typed to the content model

### Store shape (normalized maps)

- **Zustand store**: `lib/store/contentfulStore.ts`
  - Caches **ID maps**:
    - `projects: Record<string, Entry<'project'>>`
    - `categories: Record<string, Entry<'category'>>`
    - `navigationGroups: Record<string, Entry<'navigationGroup'>>`
    - `techs: Record<string, Entry<'tech'>>`
  - Tracks which models have been loaded at least once:
    - `loadedModels: { project, category, navigationGroup, tech }`
  - Provides upsert/update helpers:
    - `updateProject` is conservative (only replaces if it already exists)
    - others use `upsertX` style.

### Response normalization / interpretation

#### Published status detection

- **Helper**: `lib/contentful/isEntryPublished.ts`
  - Treats an entry as published if any of:
    - `sys.publishedAt` exists
    - `sys.firstPublishedAt` exists
    - `sys.publishedCounter > 0`
    - `sys.publishedVersion > 0`

#### Delivery sys normalization

- **Helper**: `lib/contentful/normalizeDeliveryEntry.ts`
  - The Delivery SDK payload may omit `sys.publishedAt` even for published content.
  - Normalizer “stamps” a fallback `publishedAt` from:
    - `firstPublishedAt` → `updatedAt` → `createdAt`
  - Leaves explicit draft-ish counters alone (`publishedCounter === 0` or `publishedVersion === 0`).

#### Localized field reading (CMA vs CDA shapes)

- **Helper**: `lib/contentful/readLocalizedField.ts`
  - CMA shape: `{ [locale]: value }`
  - CDA/resolved shape: scalar values
  - Avoids bugs like `Object.values('string')` → character array.

---

## 4) UI impact (what consumes data + flow)

### High-level composition

- **Root**: `components/dashboard/RootCms.tsx`
  - Manages:
    - `activeSpace` (ART / DESIGN / HUB)
    - `artModel` tab state (Project / Category / NavigationGroup / Tech)
  - Passes tabs into the top header (`SpaceVisitHeader`).

- **Workspace**: `components/dashboard/art/ArtWorkspace.tsx`
  - When `activeModel` changes:
    - calls `ensureContentfulModelLoaded(activeModel)`
  - Renders one of:
    - `ArtDashboard` (projects)
    - `CategoryDashboard`
    - `NavigationGroupDashboard`
    - `TechDashboard`

### Lists

- **List component**: `components/cms/EntryList.tsx`
  - When `cacheModel` is set:
    - list is computed from Zustand maps
    - search/pagination is in-memory
    - no list fetch on mount/back navigation
    - Refresh triggers `ensureContentfulModelLoaded(model, { force: true })`

### Edit view

- **Editor**: `components/cms/EntryEditor.tsx`
  - Loads content type schema via `/api/contentful/content-types` (CMA wrapper).
  - Attempts to use `prefetchedEntry` (from Zustand) to avoid detail fetch.
  - For Projects, only uses the prefetch if it contains the fields required to render:
    - `gallery`, `makingOf` (to ensure images/rich text are available).
  - Save flow:
    - calls server actions (`updateEntryAction` + `publishEntryAction`)
    - does **optimistic** merge into local editor state + Zustand store (no refetch).

- **Form rendering**: `components/cms/SchemaDrivenEntryForm.tsx`
  - Interprets initial values from either CMA localized maps or CDA resolved shapes.
  - Rich text rendering uses `RichTextViewer`.
  - Gallery rendering uses `ProjectGalleryUploader`.
  - Tech picker uses `ProjectTechsPicker`.

---

## 5) Optimization strategies

### Caching (client)

- Primary cache: **Zustand ID maps** in `contentfulStore`.
- Loaded flags: `loadedModels` prevents repeated fetch on tab navigation.
- Inflight dedupe:
  - `ensureContentfulModelLoaded` dedupes concurrent calls per model.

### Request reduction

- List views avoid:
  - repeated list fetch on mount/back navigation
  - full refetch after save (optimistic store update).

### Includes / depth considerations

- Delivery REST loader currently pulls entries without explicit include-depth control.
  - It is used for list rendering; if you move to GraphQL for lists, you can choose minimal fields precisely.

- GraphQL module is designed to avoid overfetch:
  - minimal `sys` + primary list fields.

### Smart cache validation by IDs (reusable)

- Utility module: `lib/store/cacheValidation.ts`
  - General pattern to fetch **only missing IDs** and merge into cache.
  - Includes inflight dedupe by `(cacheKey + missingIds)`.

This is the recommended strategy for “linked entities” such as:
- asset previews
- imageAsset entries referenced by gallery
- tech entries referenced by projects

---

## 6) Reusable patterns to replicate

### Pattern A: “Ensure loaded” + store maps

Use when:
- you have a tabbed navigation of models
- you want on-demand fetching and “no back-navigation refetch”

Key pieces:
- `loadedModels[model]` boolean
- in-flight dedupe
- `setX()` actions that accept arrays and normalize to `Record<string, Entry>`

### Pattern B: Normalize delivery payloads for UI invariants

Use when:
- you want consistent “Published” badge logic
- delivery payload shape varies (missing fields)

Key pieces:
- `normalizeDeliveryEntry`
- `isEntryPublished`

### Pattern C: Smart per-ID hydration

Use when:
- you have arrays of links (ids)
- you want to avoid “fetch 100 and filter”

Key pieces:
- `ensureCachedByIds`
- store setters that can merge partial records

### Pattern D: Safe field localization handling

Use when:
- you handle both CMA (localized maps) and CDA (resolved values)

Key pieces:
- `readLocalizedField`
- avoid `Object.values` on unknown values

---

## Appendix: Environment variables (ART)

### Management (server)
- `CONTENTFUL_MANAGEMENT_TOKEN` (required)
- `CONTENTFUL_ENVIRONMENT` (optional, default `master`)
- `CONTENTFUL_SPACE_ART_ID` (required for ART)
- `CONTENTFUL_ENTRY_LOCALE` (optional, default `en-US`)
- `CONTENTFUL_IMAGE_ASSET_CONTENT_TYPE_ID` (optional, default `imageAsset`)

### Delivery (server)
- `CONTENTFUL_DELIVERY_TOKEN` (required for Delivery REST + GraphQL modules)

---

## Notes / next steps (no code changes in this doc)

- If the goal is to standardize Delivery reads on **GraphQL**, the best next step is to rewire `ensureContentfulModelLoaded` to call `fetchProjects/fetchCategories/...` from `lib/contentful/graphql.ts` and map the result into the same store shape (ensuring `sys` fields remain compatible with `isEntryPublished`).
- For projects edit view without a second fetch, you need either:
  - a dedicated “projectDetailById” GraphQL query fetched on click (ID-based, using `ensureCachedByIds`), or
  - include the minimal edit-required fields in the list query (risking overfetch if lists are large).

