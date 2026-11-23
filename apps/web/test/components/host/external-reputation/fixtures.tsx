/**
 * @file fixtures.tsx
 * @description Shared fixtures and helpers of the external reputation section
 * tests (HOS-2515). The listings payload is built THROUGH the shared response
 * schema, so a fixture that breaks the real contract fails here (HOS-290).
 */

import type { AccommodationExternalListingsResponse } from '@repo/schemas';
import { AccommodationExternalListingsResponseSchema } from '@repo/schemas';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { ExternalReputationSection } from '@/components/host/ExternalReputationSection.client';
import type { SupportedLocale } from '@/lib/i18n';

export const ACC_ID = '11111111-1111-4111-8111-111111111111';

const LISTING_BASE = {
    accommodationId: ACC_ID,
    externalId: null,
    lifecycleState: 'ACTIVE' as const,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdById: '22222222-2222-4222-8222-222222222222',
    updatedById: '22222222-2222-4222-8222-222222222222',
    deletedAt: null,
    deletedById: null
};

export const LISTING_GOOGLE = {
    ...LISTING_BASE,
    id: '44444444-4444-4444-8444-444444444444',
    platform: 'GOOGLE' as const,
    url: 'https://maps.google.com/?cid=123',
    showLink: true,
    showReviews: false,
    verified: true
};

export const LISTING_BOOKING = {
    ...LISTING_BASE,
    id: '55555555-5555-4555-8555-555555555555',
    platform: 'BOOKING' as const,
    url: 'https://booking.com/hotel/example',
    showLink: false,
    showReviews: false,
    verified: false
};

export const META_ON = {
    showExternalReputation: true,
    aggregateFetchedAt: '2026-06-01T12:00:00.000Z',
    autoEnabledAt: null,
    toggleDecidedAt: null
};

export const META_OFF = { ...META_ON, showExternalReputation: false, aggregateFetchedAt: null };

/** Wire-shaped reputation metadata (dates arrive as ISO strings over HTTP). */
export interface MetaFixture {
    showExternalReputation: boolean;
    aggregateFetchedAt: string | null;
    autoEnabledAt: string | null;
    toggleDecidedAt: string | null;
}

/** A 200 for GET /external-listings, round-tripped through JSON like the wire. */
export function listingsResponse(
    listings: AccommodationExternalListingsResponse['listings'] = [LISTING_GOOGLE],
    reputation: MetaFixture = META_ON
): Response {
    const data = AccommodationExternalListingsResponseSchema.parse({ listings, reputation });
    return {
        ok: true,
        status: 200,
        json: async () => JSON.parse(JSON.stringify({ data })),
        headers: new Headers()
    } as unknown as Response;
}

/** A bare response with the given status and body. */
export function reply(status: number, body: unknown = {}): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
        headers: new Headers()
    } as unknown as Response;
}

/**
 * Routes `fetch` by method: GET answers the listings, everything else goes to
 * `handler` (default: 200).
 */
export function routeFetch({
    listings = [LISTING_GOOGLE],
    meta = META_ON,
    handler
}: {
    listings?: AccommodationExternalListingsResponse['listings'];
    meta?: MetaFixture;
    handler?: (url: string, init: RequestInit) => Response | Promise<Response> | undefined;
} = {}): void {
    vi.mocked(global.fetch).mockImplementation((url, init) => {
        const options = (init ?? {}) as RequestInit;
        const answer = handler?.(String(url), options);
        if (answer !== undefined) return Promise.resolve(answer);
        if (options.method === undefined && String(url).endsWith('/external-listings')) {
            return Promise.resolve(listingsResponse(listings, meta));
        }
        if (String(url).endsWith('/external-reputation/status')) {
            return Promise.resolve(
                reply(200, { success: true, data: { platforms: {}, allSettled: true } })
            );
        }
        return Promise.resolve(reply(200));
    });
}

/** The recorded calls with the given method whose URL contains `part`. */
export function callsTo({ part, method }: { part: string; method: string }) {
    return vi
        .mocked(global.fetch)
        .mock.calls.filter(
            ([url, init]) =>
                String(url).includes(part) && (init as RequestInit | undefined)?.method === method
        );
}

/** Renders the section for an accommodation. */
export function renderSection({ locale = 'es' }: { locale?: SupportedLocale } = {}) {
    return render(
        <ExternalReputationSection
            locale={locale}
            accommodationId={ACC_ID}
        />
    );
}
