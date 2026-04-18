type CmaAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'PUBLISH' | 'UNPUBLISH';

function redactKey(key: string): boolean {
  const k = key.toLowerCase();
  return (
    k.includes('token') ||
    k.includes('secret') ||
    k.includes('authorization') ||
    k.includes('password') ||
    k.includes('apikey') ||
    k.includes('api_key')
  );
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[MaxDepth]';

  if (value == null) return value;
  if (typeof value === 'string') return value.length > 2000 ? `${value.slice(0, 2000)}…[truncated]` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (Array.isArray(value)) {
    const max = 50;
    const out = value.slice(0, max).map((v) => sanitize(v, depth + 1));
    return value.length > max ? [...out, `[+${value.length - max} more]`] : out;
  }

  if (typeof value === 'object') {
    // Avoid dumping huge / circular objects; keep it JSON-ish.
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const entries = Object.entries(obj).slice(0, 80);
    for (const [k, v] of entries) {
      out[k] = redactKey(k) ? '[REDACTED]' : sanitize(v, depth + 1);
    }
    if (Object.keys(obj).length > entries.length) {
      out.__truncatedKeys = Object.keys(obj).length - entries.length;
    }
    return out;
  }

  return String(value);
}

function formatHeader(args: { action: CmaAction; contentType?: string | null; entryId?: string | null }) {
  const ct = args.contentType ? String(args.contentType) : 'unknown';
  const id = args.entryId ? String(args.entryId) : '—';
  return `[CMA] ${args.action} | ${ct} | id: ${id}`;
}

export function logCMAOperation(args: {
  action: CmaAction;
  contentType?: string | null;
  entryId?: string | null;
  payload?: unknown;
  response?: unknown;
  error?: unknown;
}) {
  const header = formatHeader(args);

  if (args.error) {
    // Always log full error (plus sanitized context) for debugging.
    // eslint-disable-next-line no-console
    console.error(
      header.replace('[CMA]', '[CMA ERROR]'),
      '\nerror:',
      args.error,
      '\npayload:',
      sanitize(args.payload),
      '\nresponse:',
      sanitize(args.response),
    );
    return;
  }

  // eslint-disable-next-line no-console
  console.log(header, '\npayload:', sanitize(args.payload), '\nresponse:', sanitize(args.response));
}

