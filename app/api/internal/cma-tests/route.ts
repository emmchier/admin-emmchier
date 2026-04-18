import { NextResponse } from 'next/server';
import { runCMATestsServer } from '@/services/runCMATests.server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  // Bind origin for server-side `contentfulService` internal fetches.
  const url = new URL(req.url);
  process.env.CONTENTFUL_SERVICE_ORIGIN = url.origin;

  const allow =
    process.env.NODE_ENV !== 'production' &&
    (url.searchParams.get('run') === 'true' || url.searchParams.get('run') === '1');

  if (!allow) {
    return NextResponse.json(
      {
        error: 'CMA tests are disabled. Add ?run=true to execute (dev-only).',
      },
      { status: 403 },
    );
  }

  const report = await runCMATestsServer();
  return NextResponse.json(report);
}

