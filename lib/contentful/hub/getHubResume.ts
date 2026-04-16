import 'server-only';

import type { Asset, Entry } from 'contentful';
import { getEntryLocale } from '@/lib/contentful/clients';
import { readLocalizedField } from '@/lib/contentful/readLocalizedField';
import { fetchHubResumeDeliveryCollection, type HubDeliveryIncludeDepth } from '@/lib/contentful/hub/delivery';

export type HubResumeTech = {
  id: string;
  nameEn: string;
  nameEs: string;
};

export type HubResumeExperience = {
  id: string;
  companyEn: string;
  companyEs: string;
  roleEn: string;
  roleEs: string;
  startDate: Date | null;
  endDate: Date | null;
  descriptionEn: string;
  descriptionEs: string;
  techs: HubResumeTech[];
};

export type HubResumeCourse = {
  id: string;
  companyEn: string;
  companyEs: string;
  titleEn: string;
  titleEs: string;
  startDate: Date | null;
  endDate: Date | null;
  descriptionEn: string;
  descriptionEs: string;
};

export type HubResumeStudy = {
  id: string;
  schoolEn: string;
  schoolEs: string;
  titleEn: string;
  titleEs: string;
  startDate: Date | null;
  endDate: Date | null;
};

export type HubResumeLanguage = {
  id: string;
  nameEn: string;
  nameEs: string;
  levelEn: string;
  levelEs: string;
};

export type HubResumePayload = {
  profileImage: string;
  experience: HubResumeExperience[];
  courses: HubResumeCourse[];
  studies: HubResumeStudy[];
  languages: HubResumeLanguage[];
};

/** Required: one CDA request, `content_type=resume`, `include=3`. */
const HUB_RESUME_INCLUDE_DEPTH = 3 satisfies HubDeliveryIncludeDepth;

function toAbsoluteCdnUrl(urlOrPath: string | null | undefined): string | null {
  if (!urlOrPath) return null;
  const s = String(urlOrPath);
  if (s.startsWith('//')) return `https:${s}`;
  return s;
}

function parseDate(raw: unknown): Date | null {
  if (!raw) return null;
  const s = String(raw);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

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

function resolveAssetUrl(raw: unknown, locale: string, assetsById: Map<string, Asset>): string | null {
  const localized = unwrapLocalizedCell(raw, locale);
  const id = linkId(localized, 'Asset');
  let asset: Asset | null = null;
  if (id) asset = assetsById.get(id) ?? null;
  else if (localized && typeof localized === 'object' && (localized as Asset).sys?.type === 'Asset') asset = localized as Asset;
  if (!asset?.fields) return null;

  const fileMap = asset.fields.file as Record<
    string,
    { url?: string; contentType?: string; details?: { image?: { width?: number; height?: number } } }
  > | undefined;
  const fileBlock =
    fileMap?.[locale] ??
    fileMap?.['en-US'] ??
    (fileMap ? (Object.values(fileMap)[0] as { url?: string } | undefined) : undefined);

  return fileBlock?.url ? toAbsoluteCdnUrl(fileBlock.url) : null;
}

function mapTech(entry: Entry, locale: string): HubResumeTech {
  const f = entry.fields as Record<string, unknown>;
  return {
    id: entry.sys.id,
    nameEn: readLocalizedField(f.nameEn, locale),
    nameEs: readLocalizedField(f.nameEs, locale),
  };
}

function mapExperience(entry: Entry, locale: string, byId: Map<string, Entry>): HubResumeExperience {
  const f = entry.fields as Record<string, unknown>;
  const techs = dedupeById(resolveEntries(f.techs, locale, byId).map((t) => mapTech(t, locale)));
  return {
    id: entry.sys.id,
    companyEn: readLocalizedField(f.companyEn, locale),
    companyEs: readLocalizedField(f.companyEs, locale),
    roleEn: readLocalizedField(f.roleEn, locale),
    roleEs: readLocalizedField(f.roleEs, locale),
    startDate: parseDate(readLocalizedField(f.startDate, locale)),
    endDate: parseDate(readLocalizedField(f.endDate, locale)),
    descriptionEn: readLocalizedField(f.descriptionEn, locale),
    descriptionEs: readLocalizedField(f.descriptionEs, locale),
    techs,
  };
}

function mapCourse(entry: Entry, locale: string): HubResumeCourse {
  const f = entry.fields as Record<string, unknown>;
  return {
    id: entry.sys.id,
    companyEn: readLocalizedField(f.companyEn, locale),
    companyEs: readLocalizedField(f.companyEs, locale),
    titleEn: readLocalizedField(f.titleEn, locale),
    titleEs: readLocalizedField(f.titleEs, locale),
    startDate: parseDate(readLocalizedField(f.startDate, locale)),
    endDate: parseDate(readLocalizedField(f.endDate, locale)),
    descriptionEn: readLocalizedField(f.descriptionEn, locale),
    descriptionEs: readLocalizedField(f.descriptionEs, locale),
  };
}

function mapStudy(entry: Entry, locale: string): HubResumeStudy {
  const f = entry.fields as Record<string, unknown>;
  return {
    id: entry.sys.id,
    schoolEn: readLocalizedField(f.schoolEn, locale),
    schoolEs: readLocalizedField(f.schoolEs, locale),
    titleEn: readLocalizedField(f.titleEn, locale),
    titleEs: readLocalizedField(f.titleEs, locale),
    startDate: parseDate(readLocalizedField(f.startDate, locale)),
    endDate: parseDate(readLocalizedField(f.endDate, locale)),
  };
}

function mapLanguage(entry: Entry, locale: string): HubResumeLanguage {
  const f = entry.fields as Record<string, unknown>;
  return {
    id: entry.sys.id,
    nameEn: readLocalizedField(f.nameEn, locale),
    nameEs: readLocalizedField(f.nameEs, locale),
    levelEn: readLocalizedField(f.levelEn, locale),
    levelEs: readLocalizedField(f.levelEs, locale),
  };
}

/**
 * HUB Resume graph for UI usage:
 * - Delivery API
 * - `content_type=resume`
 * - `include=3`
 * - No contact / social networks mapping
 * - Dates parsed as `Date`
 */
export async function getHubResume(): Promise<HubResumePayload> {
  const locale = getEntryLocale();
  const res = await fetchHubResumeDeliveryCollection({ include: HUB_RESUME_INCLUDE_DEPTH, limit: 1 });

  const resume = res.items[0] as Entry | undefined;
  if (!resume) {
    return { profileImage: '', experience: [], courses: [], studies: [], languages: [] };
  }

  const byId = buildEntryMap(res.items as Entry[], res.includes as { Entry?: Entry[] } | undefined);
  const assetsById = buildAssetMap(res.includes as { Asset?: Asset[] } | undefined);
  const rf = resume.fields as Record<string, unknown>;

  const profileImage = resolveAssetUrl(rf.profileImage, locale, assetsById) ?? '';
  const experience = dedupeById(resolveEntries(rf.workExperience, locale, byId).map((e) => mapExperience(e, locale, byId)));
  const courses = dedupeById(resolveEntries(rf.courses, locale, byId).map((e) => mapCourse(e, locale)));
  const studies = dedupeById(resolveEntries(rf.studies, locale, byId).map((e) => mapStudy(e, locale)));
  const languages = dedupeById(resolveEntries(rf.languages, locale, byId).map((e) => mapLanguage(e, locale)));

  return { profileImage, experience, courses, studies, languages };
}

