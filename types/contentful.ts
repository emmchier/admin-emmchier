/* eslint-disable */
// AUTO-GENERATED from contentful-export/export.json
// Locale assumed: en-US

export type ContentTypeId = 'tech' | 'imageAsset' | 'project' | 'navigationGroup' | 'category';

export type ContentfulSysLink<TLinkType extends string> = { sys: { type: 'Link'; linkType: TLinkType; id: string } };
export type AssetLink = ContentfulSysLink<'Asset'>;
export type EntryLink<TContentTypeId extends ContentTypeId = ContentTypeId> = ContentfulSysLink<'Entry'> & { sys: { contentType?: { sys: { id: TContentTypeId } } } };

export type ContentfulRichTextDocument = Record<string, unknown>;

export type EntryFieldsByType = {
  'tech': Tech;
  'imageAsset': ImageAsset;
  'project': Project;
  'navigationGroup': NavigationGroup;
  'category': Category;
};

export interface Tech {
  "name": string;
  "slug": string;
  "order": number | undefined;
}

export interface ImageAsset {
  "title": string | undefined;
  "slug": string;
  "image": AssetLink;
  "alt": string;
}

export interface Project {
  "title": string;
  "slug": string;
  "description": string | undefined;
  "gallery": Array<EntryLink<'imageAsset'>>;
  "makingOf": ContentfulRichTextDocument | undefined;
  "techs": Array<EntryLink<'tech'>> | undefined;
}

export interface NavigationGroup {
  "title": string;
  "items": Array<EntryLink<'project'>> | undefined;
}

export interface Category {
  "title": string;
  "slug": string;
  "order": number | undefined;
  "projectsTree": Array<EntryLink<'project'> | EntryLink<'navigationGroup'>> | undefined;
}

export type Entry<T extends ContentTypeId = ContentTypeId> = {
  sys: { id: string; contentType: { sys: { id: T } }; createdAt?: string; updatedAt?: string; publishedAt?: string };
  fields: EntryFieldsByType[T];
};
