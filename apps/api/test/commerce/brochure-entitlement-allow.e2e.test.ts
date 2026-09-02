/**
 * The brochure gate — ALLOW side, end to end (HOS-1058).
 *
 * ---
 * Companion of `brochure-entitlement.e2e.test.ts`; read that file's header
 * first. This half asserts that a caller who DOES hold the grant reaches the
 * handler, which is what fails if
 * `commerceVerticalEntitlementMiddleware(vertical)` is dropped from a brochure
 * route or mounted AFTER its gate — in either case the gate reads the
 * ACCOMMODATION set, which never carries a commerce key, and refuses everyone.
 *
 * ## What is mutated, and why it is the honest mutation
 *
 * `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL` is widened to include
 * `DOWNLOAD_LISTING_PDF`, which is how the middleware sees a caller who holds
 * the grant: the real premium path unions the plan ROW's `entitlements` onto
 * that same set, into the same `Set` the gate then reads. Mocking at the CONFIG
 * boundary keeps the whole chain real — route factory, auth, the global
 * entitlement middleware, the commerce loader, and `requireEntitlement` — and
 * changes only what the catalogue says the caller's plan grants.
 *
 * Whether the PREMIUM plan actually carries the key (and básico does not) is a
 * different question, asserted where the catalogue itself lives:
 * `packages/billing/test/commerce-vertical-plans.test.ts`.
 *
 * @module test/commerce/brochure-entitlement-allow.e2e
 */

import { ExperienceService, GastronomyService } from '@repo/service-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { drawsText } from '../helpers/pdf-text.ts';

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        // What a premium subscriber's resolved set looks like: the vertical's
        // uniform pair plus the premium-only brochure key.
        ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL: {
            gastronomy: [
                actual.EntitlementKey.EDIT_GASTRONOMY_INFO,
                actual.EntitlementKey.PUBLISH_GASTRONOMY,
                actual.EntitlementKey.DOWNLOAD_LISTING_PDF
            ],
            experience: [
                actual.EntitlementKey.EDIT_EXPERIENCE_INFO,
                actual.EntitlementKey.PUBLISH_EXPERIENCE,
                actual.EntitlementKey.DOWNLOAD_LISTING_PDF
            ]
        }
    };
});

const { initApp } = await import('../../src/app.js');
const { _resetCommerceBaseLimitCache } = await import(
    '../../src/middlewares/commerce-entitlement.js'
);
type AppOpenAPI = import('../../src/types.js').AppOpenAPI;

const USER_AGENT = { 'user-agent': 'vitest' };
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const LISTING_ID = '22222222-2222-4222-8222-222222222222';

const ownerHeaders = {
    ...USER_AGENT,
    'x-mock-actor-id': OWNER_ID,
    'x-mock-actor-role': 'COMMERCE_OWNER',
    'x-mock-actor-permissions': JSON.stringify(['commerce.create', 'commerce.editOwn'])
};

/** A `Result`-shaped failure, so the stubbed service call returns cleanly. */
const NOT_FOUND_RESULT = {
    data: undefined,
    error: { code: 'NOT_FOUND', message: 'listing not found' }
} as never;

const CASES = [
    {
        label: 'gastronomy brochure',
        path: `/api/v1/protected/gastronomies/${LISTING_ID}/brochure`,
        service: GastronomyService
    },
    {
        label: 'experience brochure',
        path: `/api/v1/protected/experiences/${LISTING_ID}/brochure`,
        service: ExperienceService
    }
] as const;

describe('commerce brochure entitlement gate — allow side (HOS-1058)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        _resetCommerceBaseLimitCache();
    });

    for (const testCase of CASES) {
        it(`lets an entitled owner reach the ${testCase.label} handler`, async () => {
            // The witness: the handler's first call, which runs strictly after
            // the gate. `requireEntitlement` throws before `next()`, so this
            // having been called is proof the gate let the request through.
            const witness = vi
                .spyOn(testCase.service.prototype, 'getById')
                .mockResolvedValue(NOT_FOUND_RESULT);

            const res = await app.request(testCase.path, { headers: ownerHeaders });
            const body = (await res.json().catch(() => ({}))) as { error?: { code?: string } };

            expect(body.error?.code).not.toBe('ENTITLEMENT_REQUIRED');
            expect(res.status).not.toBe(403);
            expect(witness).toHaveBeenCalledTimes(1);
        });
    }

    it('answers a real PDF file, end to end, for a published listing', async () => {
        // The whole point of the feature, asserted through the real route: a
        // body a viewer opens, under a download header. The route returns a raw
        // `Response`, so nothing about this shape is validated by the schema
        // machinery — if it were broken, every test above would still pass.
        vi.spyOn(GastronomyService.prototype, 'getById').mockResolvedValue({
            data: {
                id: LISTING_ID,
                slug: 'la-parrilla-del-puerto',
                name: 'La Parrilla del Puerto',
                type: 'PARRILLA',
                summary: 'Parrilla a la vista sobre el río Uruguay.',
                description: 'Una descripción suficientemente larga para el tier público.',
                visibility: 'PUBLIC',
                ownerId: OWNER_ID,
                openingHours: {
                    days: { mon: { closed: true, shifts: [] } }
                },
                // No cover: the fetch is deliberately not exercised here, so the
                // test stays offline and deterministic.
                media: null
            },
            error: undefined
        } as never);

        const res = await app.request(`/api/v1/protected/gastronomies/${LISTING_ID}/brochure`, {
            headers: ownerHeaders
        });

        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('application/pdf');
        expect(res.headers.get('content-disposition')).toBe(
            'attachment; filename="ficha-la-parrilla-del-puerto.pdf"'
        );

        const bytes = Buffer.from(await res.arrayBuffer());
        // The header, not the version. Which PDF version comes out is the
        // renderer's business: the hand-written writer emitted 1.4 and pdf-lib
        // emits 1.7, both equally valid. Pinning it turns swapping the library
        // into a test failure rather than a decision.
        expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
        expect(bytes.toString('latin1')).toContain('%%EOF');
        // The listing's own name reached the page, so this is that listing's
        // sheet rather than an empty template. Read it through the inflated
        // streams: pdf-lib Flate-compresses content, so a raw-bytes search
        // would be false no matter what the sheet says.
        expect(drawsText(bytes, 'La Parrilla del Puerto')).toBe(true);
    });

    it('refuses to print a listing that has no public page', async () => {
        // A draft has no ficha to print, and its QR would send every reader to
        // a 404. NOT_FOUND, never a sheet.
        vi.spyOn(GastronomyService.prototype, 'getById').mockResolvedValue({
            data: {
                id: LISTING_ID,
                slug: 'borrador',
                name: 'Borrador',
                type: 'PARRILLA',
                visibility: 'PRIVATE',
                ownerId: OWNER_ID
            },
            error: undefined
        } as never);

        const res = await app.request(`/api/v1/protected/gastronomies/${LISTING_ID}/brochure`, {
            headers: ownerHeaders
        });

        expect(res.status).toBe(404);
        expect(res.headers.get('content-type')).not.toBe('application/pdf');
    });

    it('answers NOT_FOUND for a listing that belongs to somebody else', async () => {
        // 404 rather than 403: a 403 would confirm the id exists
        // (`apps/api/docs/error-contract.md`).
        vi.spyOn(GastronomyService.prototype, 'getById').mockResolvedValue({
            data: {
                id: LISTING_ID,
                slug: 'de-otro',
                name: 'De otro',
                type: 'PARRILLA',
                visibility: 'PUBLIC',
                ownerId: '99999999-9999-4999-8999-999999999999'
            },
            error: undefined
        } as never);

        const res = await app.request(`/api/v1/protected/gastronomies/${LISTING_ID}/brochure`, {
            headers: ownerHeaders
        });

        expect(res.status).toBe(404);
    });
});
