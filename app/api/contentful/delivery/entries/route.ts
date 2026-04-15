import { NextResponse } from 'next/server';
import { artClients } from '@/lib/contentful/clients';
import { normalizeDeliveryEntry } from '@/lib/contentful/normalizeDeliveryEntry';

export const runtime = 'nodejs';

const ALLOWED_CONTENT_TYPES = new Set(['project', 'category', 'navigationGroup', 'tech']);

/**
 * Contentful Delivery API (read-only, published entries).
 * Uses ART delivery client (CONTENTFUL_ART_DELIVERY_TOKEN).
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const contentType = url.searchParams.get('contentType');
    if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json({ error: 'Invalid or missing contentType' }, { status: 400 });
    }

    const limitRaw = url.searchParams.get('limit');
    const limit = Math.min(1000, Math.max(1, limitRaw ? Number.parseInt(limitRaw, 10) || 1000 : 1000));

    const res = await artClients.deliveryClient.getEntries({
      content_type: contentType,
      limit,
      order: ['-sys.updatedAt'],
    });

    const items = res.items.map((item) => normalizeDeliveryEntry(item as any));

    return NextResponse.json({
      items,
      total: res.total,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Delivery API error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
