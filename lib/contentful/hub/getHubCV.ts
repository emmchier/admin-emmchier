import 'server-only';

import type { Asset, Entry } from 'contentful';
import { getEntryLocale } from '@/lib/contentful/clients';
import { readLocalizedField } from '@/lib/contentful/readLocalizedField';
import { fetchHubResumeDeliveryCollection } from '@/lib/contentful/hub/delivery';
import type {
  HubCVContact,
  HubCVCourse,
  HubCVExperience,
  HubCVLanguage,
  HubCVPayload,
  HubCVProfileImage,
  HubCVSocialNetwork,
  HubCVStudy,
} from '@/lib/contentful/hub/hubCvTypes';

/** Max link depth from `resume`: direct links + one hop (e.g. `contact` → `socialNetwork`, `experience` → `tech`). */
const HUB_CV_INCLUDE_DEPTH = 2 as const;

function toAbsoluteCdnUrl(urlOrPath: string | null | undefined): string | null {
  if (!urlOrPath) return null;
  const s = String(urlOrPath);
  if (s.startsWith('//')) return `https:${s}`;
  return s;
}

/** CDA / CMA: unwrap `{ [locale]: value }` for link and scalar cells. */
function unwrapLocalizedCell(raw: unknown, locale: string): unknown {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const o = raw as Record<string, unknown>;
  if (o.sys != null && typeof o.sys === 'object') return raw;
  if (o.nodeType === 'document') return raw;
  const v = o[locale] ?? o['en-US'];
  if (v !== undefined && v !== null) return v;
  const vals = Object.values(o);
  return vals.length ? vals[0] : null;
}

function buildEntryMap(items: readonly Entry[], includes?: { Entry?: Entry[] }): Map<string, Entry> {
  const map = new Map<string, Entry>();
  for (const e of items) {
    if (e?.sys?.id) map.set(e.sys.id, e);
  }
  for (const e of includes?.Entry ?? []) {
    if (e?.sys?.id) map.set(e.sys.id, e);
  }
  return map;
}

function buildAssetMap(includes?: { Asset?: Asset[] }): Map<string, Asset> {
  const map = new Map<string, Asset>();
  for (const a of includes?.Asset ?? []) {
    if (a?.sys?.id) map.set(a.sys.id, a);
  }
  return map;
}

/** Entry or Asset link id, or resolved resource id */
function linkId(raw: unknown, linkType: 'Entry' | 'Asset'): string | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as { sys?: { type?: string; linkType?: string; id?: string } };
  if (!o.sys?.id) return null;
  if (o.sys.type === 'Link' && o.sys.linkType === linkType) return o.sys.id;
  if (o.sys.type === linkType) return o.sys.id;
  return null;
}

function unwrapFieldLinks(raw: unknown): unknown[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  return [raw];
}

function resolveEntry(raw: unknown, byId: Map<string, Entry>): Entry | null {
  const id = linkId(raw, 'Entry');
  if (id) {
    const fromMap = byId.get(id);
    if (fromMap) return fromMap;
  }
  if (raw && typeof raw === 'object' && (raw as Entry).sys?.type === 'Entry' && (raw as Entry).fields) {
    return raw as Entry;
  }
  return null;
}

function resolveEntries(raw: unknown, locale: string, byId: Map<string, Entry>): Entry[] {
  const cell = unwrapLocalizedCell(raw, locale);
  const out: Entry[] = [];
  for (const chunk of unwrapFieldLinks(cell)) {
    const e = resolveEntry(chunk, byId);
    if (e?.sys?.id) out.push(e);
  }
  return out;
}

function mapProfileImage(raw: unknown, locale: string, assetsById: Map<string, Asset>): HubCVProfileImage | null {
  const localized = unwrapLocalizedCell(raw, locale);
  const id = linkId(localized, 'Asset');
  let asset: Asset | null = null;
  if (id) asset = assetsById.get(id) ?? null;
  else if (localized && typeof localized === 'object' && (localized as Asset).sys?.type === 'Asset')
    asset = localized as Asset;
  if (!asset?.fields) {
    if (id) return { id, url: null, title: null, width: null, height: null, contentType: null };
    return null;
  }

  const fileMap = asset.fields.file as Record<string, { url?: string; contentType?: string; details?: { image?: { width?: number; height?: number } } }> | undefined;
  const fileBlock =
    fileMap?.[locale] ?? fileMap?.['en-US'] ?? (fileMap ? (Object.values(fileMap)[0] as { url?: string; contentType?: string; details?: { image?: { width?: number; height?: number } } } | undefined) : undefined);

  const url = fileBlock?.url ? toAbsoluteCdnUrl(fileBlock.url) : null;
  const title = readLocalizedField(asset.fields.title as unknown, locale);

  return {
    id: asset.sys.id,
    url,
    title: title || null,
    width: fileBlock?.details?.image?.width ?? null,
    height: fileBlock?.details?.image?.height ?? null,
    contentType: fileBlock?.contentType ? String(fileBlock.contentType) : null,
  };
}

function mapExperience(entry: Entry, locale: string): HubCVExperience {
  const f = entry.fields as Record<string, unknown>;
  return {
    id: entry.sys.id,
    companyEn: readLocalizedField(f.companyEn, locale),
    companyEs: readLocalizedField(f.companyEs, locale),
    roleEn: readLocalizedField(f.roleEn, locale),
    roleEs: readLocalizedField(f.roleEs, locale),
    startDate: readLocalizedField(f.startDate, locale),
    endDate: readLocalizedField(f.endDate, locale),
    descriptionEn: readLocalizedField(f.descriptionEn, locale),
    descriptionEs: readLocalizedField(f.descriptionEs, locale),
  };
}

function mapCourse(entry: Entry, locale: string): HubCVCourse {
  const f = entry.fields as Record<string, unknown>;
  return {
    id: entry.sys.id,
    companyEn: readLocalizedField(f.companyEn, locale),
    companyEs: readLocalizedField(f.companyEs, locale),
    titleEn: readLocalizedField(f.titleEn, locale),
    titleEs: readLocalizedField(f.titleEs, locale),
    startDate: readLocalizedField(f.startDate, locale),
    endDate: readLocalizedField(f.endDate, locale),
    descriptionEn: readLocalizedField(f.descriptionEn, locale),
    descriptionEs: readLocalizedField(f.descriptionEs, locale),
  };
}

function mapStudy(entry: Entry, locale: string): HubCVStudy {
  const f = entry.fields as Record<string, unknown>;
  return {
    id: entry.sys.id,
    schoolEn: readLocalizedField(f.schoolEn, locale),
    schoolEs: readLocalizedField(f.schoolEs, locale),
    titleEn: readLocalizedField(f.titleEn, locale),
    titleEs: readLocalizedField(f.titleEs, locale),
    startDate: readLocalizedField(f.startDate, locale),
    endDate: readLocalizedField(f.endDate, locale),
  };
}

function mapLanguage(entry: Entry, locale: string): HubCVLanguage {
  const f = entry.fields as Record<string, unknown>;
  return {
    id: entry.sys.id,
    nameEn: readLocalizedField(f.nameEn, locale),
    nameEs: readLocalizedField(f.nameEs, locale),
    levelEn: readLocalizedField(f.levelEn, locale),
    levelEs: readLocalizedField(f.levelEs, locale),
  };
}

function mapSocialNetwork(entry: Entry, locale: string): HubCVSocialNetwork {
  const f = entry.fields as Record<string, unknown>;
  return {
    id: entry.sys.id,
    platform: readLocalizedField(f.platform, locale),
    url: readLocalizedField(f.url, locale),
    username: readLocalizedField(f.username, locale),
  };
}

function mapContact(entry: Entry | null, locale: string, byId: Map<string, Entry>): HubCVContact | null {
  if (!entry?.fields) return null;
  const f = entry.fields as Record<string, unknown>;
  const email = readLocalizedField(f.email, locale);
  const socialEntries = resolveEntries(f.socialNetworks, locale, byId);
  const socialNetworks = socialEntries.map((e) => mapSocialNetwork(e, locale));
  return { email, socialNetworks };
}

/** Same entry can appear twice if Contentful stores duplicate links; keep first occurrence. */
function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}

function mapResumeToPayload(resume: Entry, locale: string, byId: Map<string, Entry>, assetsById: Map<string, Asset>): HubCVPayload {
  const rf = resume.fields as Record<string, unknown>;

  const experience = dedupeById(resolveEntries(rf.workExperience, locale, byId).map((e) => mapExperience(e, locale)));
  const courses = dedupeById(resolveEntries(rf.courses, locale, byId).map((e) => mapCourse(e, locale)));
  const studies = dedupeById(resolveEntries(rf.studies, locale, byId).map((e) => mapStudy(e, locale)));
  const languages = dedupeById(resolveEntries(rf.languages, locale, byId).map((e) => mapLanguage(e, locale)));

  const contactEntry = resolveEntry(unwrapLocalizedCell(rf.contact, locale), byId);
  const contactRaw = mapContact(contactEntry, locale, byId);
  const contact = contactRaw
    ? { ...contactRaw, socialNetworks: dedupeById(contactRaw.socialNetworks) }
    : null;

  return {
    resumeId: resume.sys.id,
    profileImage: mapProfileImage(rf.profileImage, locale, assetsById),
    experience,
    courses,
    studies,
    languages,
    contact,
  };
}

/**
 * One Delivery API request: published `resume` + linked entries/assets.
 * `include: 2` resolves: `resume` → (`experience` → `tech`, `contact` → `socialNetwork`, …) without extra fetches.
 */
export async function getHubCV(): Promise<HubCVPayload> {
  const locale = getEntryLocale();
  const res = await fetchHubResumeDeliveryCollection({ include: HUB_CV_INCLUDE_DEPTH, limit: 1 });

  const resume = res.items[0] as Entry | undefined;
  if (!resume) {
    return {
      resumeId: null,
      profileImage: null,
      experience: [],
      courses: [],
      studies: [],
      languages: [],
      contact: null,
    };
  }

  const byId = buildEntryMap(res.items as Entry[], res.includes as { Entry?: Entry[] } | undefined);
  const assetsById = buildAssetMap(res.includes as { Asset?: Asset[] } | undefined);

  return mapResumeToPayload(resume, locale, byId, assetsById);
}
