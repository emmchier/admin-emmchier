/**
 * Export Contentful content types (Management API) for a given space.
 *
 * Usage:
 *   node scripts/contentful/export-content-model.mjs --space art
 *   node scripts/contentful/export-content-model.mjs --space hub
 *   node scripts/contentful/export-content-model.mjs --space design
 *   node scripts/contentful/export-content-model.mjs --space hub --out docs/custom.json
 *
 * Reads `.env.local` from repo root (same pattern as other scripts).
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from 'contentful-management';

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env.local');

const SPACES = {
  art: {
    label: 'ART',
    spaceIdEnv: 'CONTENTFUL_SPACE_ART_ID',
    managementTokenEnv: 'CONTENTFUL_ART_MANAGEMENT_TOKEN',
    defaultOut: path.join(ROOT, 'docs', 'art-content-model.json'),
  },
  hub: {
    label: 'HUB',
    spaceIdEnv: 'CONTENTFUL_SPACE_HUB_ID',
    managementTokenEnv: 'CONTENTFUL_HUB_MANAGEMENT_TOKEN',
    defaultOut: path.join(ROOT, 'docs', 'hub-content-model.json'),
  },
  design: {
    label: 'DESIGN',
    spaceIdEnv: 'CONTENTFUL_SPACE_DESIGN_ID',
    managementTokenEnv: 'CONTENTFUL_DESIGN_MANAGEMENT_TOKEN',
    defaultOut: path.join(ROOT, 'docs', 'design-content-model.json'),
  },
};

function usage() {
  process.stderr.write(
    [
      'Export Contentful content types (CMA) for ART, HUB, or DESIGN.',
      '',
      'Usage:',
      '  node scripts/contentful/export-content-model.mjs --space <art|hub|design> [--out path]',
      '',
      'Examples:',
      '  node scripts/contentful/export-content-model.mjs --space art',
      '  node scripts/contentful/export-content-model.mjs --space hub --out docs/hub-content-model.json',
      '',
    ].join('\n'),
  );
}

function parseArgs(argv) {
  let space = null;
  let out = null;
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--space=')) {
      space = a.slice('--space='.length).trim();
    } else if (a === '--space') {
      space = String(argv[++i] ?? '').trim();
    } else if (a.startsWith('--out=')) {
      out = a.slice('--out='.length).trim();
    } else if (a === '--out') {
      out = String(argv[++i] ?? '').trim();
    } else if (a === '--help' || a === '-h') {
      usage();
      process.exit(0);
    }
  }
  return { space, out };
}

function parseDotEnv(text) {
  const out = {};
  const lines = String(text ?? '').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function requireEnv(name, env) {
  const v = (env[name] ?? process.env[name] ?? '').trim();
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function pickRefInfo(field) {
  if (field?.type === 'Link') {
    const linkType = field.linkType;
    const linkContentType =
      linkType === 'Entry'
        ? field.validations?.find((v) => Array.isArray(v?.linkContentType))?.linkContentType ?? []
        : [];
    return { kind: linkType, cardinality: 'single', linkContentType };
  }
  if (field?.type === 'Array' && field.items?.type === 'Link') {
    const linkType = field.items.linkType;
    const linkContentType =
      linkType === 'Entry'
        ? field.items.validations?.find((v) => Array.isArray(v?.linkContentType))?.linkContentType ?? []
        : [];
    return { kind: linkType, cardinality: 'array', linkContentType };
  }
  return null;
}

function normalizeField(field) {
  const ref = pickRefInfo(field);
  return {
    id: field.id,
    name: field.name,
    type: field.type,
    linkType: field.linkType,
    required: Boolean(field.required),
    localized: Boolean(field.localized),
    disabled: Boolean(field.disabled),
    omitted: Boolean(field.omitted),
    validations: field.validations ?? [],
    items: field.items ?? null,
    reference: ref,
  };
}

function normalizeContentType(ct) {
  return {
    id: ct?.sys?.id,
    name: ct?.name,
    description: ct?.description ?? null,
    displayField: ct?.displayField ?? null,
    sys: {
      publishedAt: ct?.sys?.publishedAt ?? null,
      firstPublishedAt: ct?.sys?.firstPublishedAt ?? null,
      updatedAt: ct?.sys?.updatedAt ?? null,
      createdAt: ct?.sys?.createdAt ?? null,
      version: ct?.sys?.version ?? null,
    },
    fields: Array.isArray(ct?.fields) ? ct.fields.map(normalizeField) : [],
  };
}

async function main() {
  const { space: spaceArg, out: outArg } = parseArgs(process.argv);
  if (!spaceArg) {
    usage();
    process.exit(1);
  }

  const spaceKey = spaceArg.toLowerCase();
  const cfg = SPACES[spaceKey];
  if (!cfg) {
    throw new Error(`Unknown --space "${spaceArg}". Use: art | hub | design`);
  }

  const envText = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const env = parseDotEnv(envText);

  const token = requireEnv(cfg.managementTokenEnv, env);
  const spaceId = requireEnv(cfg.spaceIdEnv, env);
  const environmentId = requireEnv('CONTENTFUL_ENVIRONMENT', env);
  const outPath = outArg ? path.resolve(ROOT, outArg) : cfg.defaultOut;

  const client = createClient({ accessToken: token });
  let res;
  try {
    res = await client.contentType.getMany({
      spaceId,
      environmentId,
      query: { limit: 1000, order: 'sys.id' },
    });
  } catch (err) {
    const msg = String(err?.message ?? err);
    if (msg.includes('403')) {
      throw new Error(
        `403 Forbidden: ${cfg.managementTokenEnv} does not have access to space ${spaceId} (${cfg.label}).`,
      );
    }
    throw err;
  }

  const items = (res.items ?? []).map(normalizeContentType);
  const out = {
    meta: {
      space: spaceKey,
      label: cfg.label,
      spaceId,
      environmentId,
      total: res.total ?? items.length,
      fetchedAt: new Date().toISOString(),
    },
    contentTypes: items,
  };

  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
  process.stdout.write(`[${cfg.label}] Wrote ${items.length} content types → ${outPath}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
