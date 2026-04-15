import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const EXPORT_PATH = path.join(ROOT, 'contentful-export', 'export.json');
const DOCS_DIR = path.join(ROOT, 'docs', 'contentful');
const TYPES_PATH = path.join(ROOT, 'types', 'contentful.ts');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function mdEscape(s) {
  return String(s ?? '').replaceAll('\r\n', '\n').trim();
}

function pickLocale(exportJson) {
  const code = exportJson?.locales?.[0]?.code;
  return code || 'en-US';
}

function getFieldValue(fields, fieldId, locale) {
  const v = fields?.[fieldId];
  if (!v) return undefined;
  return v[locale] ?? v['en-US'] ?? Object.values(v)[0];
}

function inferCardinality(field) {
  if (field.type === 'Array') return 'array';
  return 'single';
}

function describeValidations(validations = []) {
  if (!Array.isArray(validations) || validations.length === 0) return 'none';
  // keep it readable; Contentful validations can be very nested
  return validations.map((v) => JSON.stringify(v)).join(', ');
}

function relationshipInfo(field) {
  if (field.type === 'Link' && field.linkType === 'Entry') {
    return { kind: 'entry', cardinality: 'single', contentTypes: field.validations?.find((v) => v.linkContentType)?.linkContentType || [] };
  }
  if (field.type === 'Link' && field.linkType === 'Asset') {
    return { kind: 'asset', cardinality: 'single', contentTypes: [] };
  }
  if (field.type === 'Array' && field.items?.type === 'Link' && field.items?.linkType === 'Entry') {
    return { kind: 'entry', cardinality: 'array', contentTypes: field.items.validations?.find((v) => v.linkContentType)?.linkContentType || [] };
  }
  if (field.type === 'Array' && field.items?.type === 'Link' && field.items?.linkType === 'Asset') {
    return { kind: 'asset', cardinality: 'array', contentTypes: [] };
  }
  return null;
}

function inferPurpose(ct) {
  const bits = [];
  if (ct.description) bits.push(ct.description);
  if (ct.name && !ct.description) bits.push(`Content entries of type “${ct.name}”.`);
  const relFields = (ct.fields || []).filter((f) => relationshipInfo(f));
  if (relFields.length) {
    bits.push(`Links: ${relFields.map((f) => f.id).join(', ')}.`);
  }
  return bits.join(' ');
}

function toPascalCase(id) {
  return String(id)
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

function tsTypeForField(field, locale) {
  const required = !!field.required;

  const rel = relationshipInfo(field);
  if (rel) {
    const base =
      rel.kind === 'asset'
        ? 'AssetLink'
        : rel.contentTypes?.length
          ? rel.contentTypes.map((t) => `EntryLink<'${t}'>`).join(' | ')
          : `EntryLink`;
    const t = rel.cardinality === 'array' ? `Array<${base}>` : base;
    return required ? t : `${t} | undefined`;
  }

  let base;
  switch (field.type) {
    case 'Symbol':
    case 'Text':
    case 'Date':
      base = 'string';
      break;
    case 'Integer':
    case 'Number':
      base = 'number';
      break;
    case 'Boolean':
      base = 'boolean';
      break;
    case 'Object':
      base = 'Record<string, unknown>';
      break;
    case 'RichText':
      base = 'ContentfulRichTextDocument';
      break;
    case 'Location':
      base = '{ lat: number; lon: number }';
      break;
    case 'Array': {
      // non-link arrays (symbols, etc)
      const item = field.items;
      if (!item) base = 'unknown[]';
      else if (item.type === 'Symbol') base = 'string[]';
      else if (item.type === 'Integer' || item.type === 'Number') base = 'number[]';
      else if (item.type === 'Boolean') base = 'boolean[]';
      else base = 'unknown[]';
      break;
    }
    default:
      base = 'unknown';
  }

  return required ? base : `${base} | undefined`;
}

function main() {
  if (!fs.existsSync(EXPORT_PATH)) {
    console.error(`Missing export file at ${EXPORT_PATH}`);
    process.exit(1);
  }

  const data = readJson(EXPORT_PATH);
  const locale = pickLocale(data);
  const contentTypes = data.contentTypes || [];
  const entries = data.entries || [];

  ensureDir(DOCS_DIR);
  ensureDir(path.dirname(TYPES_PATH));

  // --- docs ---
  for (const ct of contentTypes) {
    const ctId = ct.sys?.id;
    const fileName = `${ctId}.md`;
    const p = path.join(DOCS_DIR, fileName);

    const example = entries.find((e) => e.sys?.contentType?.sys?.id === ctId);

    const fields = ct.fields || [];
    const relationships = fields
      .map((f) => ({ f, rel: relationshipInfo(f) }))
      .filter((x) => x.rel);

    const md = [
      `### Content Model: ${mdEscape(ct.name)} (\`${ctId}\`)`,
      ``,
      `#### Purpose`,
      mdEscape(inferPurpose(ct)) || '—',
      ``,
      `#### Fields`,
      ...fields.map((f) => {
        const req = f.required ? 'yes' : 'no';
        const validations = describeValidations(f.validations);
        const items = f.type === 'Array' ? ` (items: ${f.items?.type || 'unknown'}${f.items?.linkType ? ` ${f.items.linkType}` : ''})` : '';
        return `- **${f.id}** (\`${f.type}${f.linkType ? `:${f.linkType}` : ''}\`${items})\n  - required: **${req}**\n  - validations: \`${validations}\`\n  - description: ${mdEscape(f.name) || '—'}`;
      }),
      ``,
      `#### Relationships`,
      relationships.length
        ? relationships.map(({ f, rel }) => {
            const targets =
              rel.kind === 'asset'
                ? 'Asset'
                : rel.contentTypes?.length
                  ? rel.contentTypes.map((t) => `\`${t}\``).join(', ')
                  : 'Entry (any)';
            return `- **${f.id}**: ${rel.kind} link · ${rel.cardinality} · targets: ${targets}`;
          })
        : ['—'],
      ``,
      `#### Example Entry`,
      example
        ? '```json\n' +
          JSON.stringify(
            {
              sys: example.sys,
              fields: example.fields,
            },
            null,
            2,
          ) +
          '\n```'
        : '—',
      ``,
      `#### Usage in Frontend`,
      `- List view: show key fields and status (draft/published).`,
      `- Edit view: schema-driven form mapped from Contentful field definitions.`,
      `- Relations: resolve entry/asset links via Management API lookups.`,
      ``,
    ].join('\n');

    fs.writeFileSync(p, md, 'utf8');
  }

  // --- types ---
  const typeIds = contentTypes.map((ct) => ct.sys?.id).filter(Boolean);

  const lines = [];
  lines.push(`/* eslint-disable */`);
  lines.push(`// AUTO-GENERATED from contentful-export/export.json`);
  lines.push(`// Locale assumed: ${locale}`);
  lines.push('');
  lines.push(`export type ContentTypeId = ${typeIds.map((id) => `'${id}'`).join(' | ') || 'string'};`);
  lines.push('');
  lines.push(`export type ContentfulSysLink<TLinkType extends string> = { sys: { type: 'Link'; linkType: TLinkType; id: string } };`);
  lines.push(`export type AssetLink = ContentfulSysLink<'Asset'>;`);
  lines.push(`export type EntryLink<TContentTypeId extends ContentTypeId = ContentTypeId> = ContentfulSysLink<'Entry'> & { sys: { contentType?: { sys: { id: TContentTypeId } } } };`);
  lines.push('');
  lines.push(`export type ContentfulRichTextDocument = Record<string, unknown>;`);
  lines.push('');
  lines.push(`export type EntryFieldsByType = {`);

  for (const ct of contentTypes) {
    const ctId = ct.sys?.id;
    const iface = toPascalCase(ctId);
    lines.push(`  '${ctId}': ${iface};`);
  }
  lines.push(`};`);
  lines.push('');

  for (const ct of contentTypes) {
    const ctId = ct.sys?.id;
    const iface = toPascalCase(ctId);
    lines.push(`export interface ${iface} {`);
    for (const f of ct.fields || []) {
      const name = f.id;
      const t = tsTypeForField(f, locale);
      lines.push(`  ${JSON.stringify(name)}: ${t};`);
    }
    lines.push(`}`);
    lines.push('');
  }

  lines.push(`export type Entry<T extends ContentTypeId = ContentTypeId> = {`);
  lines.push(`  sys: { id: string; contentType: { sys: { id: T } }; createdAt?: string; updatedAt?: string; publishedAt?: string };`);
  lines.push(`  fields: EntryFieldsByType[T];`);
  lines.push(`};`);
  lines.push('');

  fs.writeFileSync(TYPES_PATH, lines.join('\n'), 'utf8');

  console.log(`Generated docs: ${DOCS_DIR}`);
  console.log(`Generated types: ${TYPES_PATH}`);
}

main();

