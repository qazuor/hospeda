/**
 * The experience-certificate gate — ALLOW side, end to end (HOS-1057).
 *
 * ---
 * Companion of `experience-certificate-entitlement.e2e.test.ts`; read that
 * file's header first. This half asserts that a caller who DOES hold the grant
 * reaches the handler, which is what fails if
 * `commerceVerticalEntitlementMiddleware('experience')` is dropped from a
 * certificate route or mounted AFTER its gate — in either case the gate reads
 * the ACCOMMODATION set, which never carries a commerce key, and refuses
 * everyone.
 *
 * ## What is mutated, and why it is the honest mutation
 *
 * `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL` is widened to include
 * `ISSUE_EXPERIENCE_CERTIFICATE`, which is how the middleware sees a caller who
 * holds the grant: the real `-pro` path unions the plan ROW's `entitlements`
 * onto that same set, into the same `Set` the gate then reads. Mocking at the
 * CONFIG boundary keeps the whole chain real — route factory, auth, the global
 * entitlement middleware, the commerce loader, and `requireEntitlement` — and
 * changes only what the catalogue says the caller's plan grants.
 *
 * Whether `experience-pro` actually carries the key (and `-basico` does not) is
 * a different question, asserted where the catalogue lives:
 * `packages/billing/test/commerce-vertical-plans.test.ts`.
 *
 * @module test/commerce/experience-certificate-entitlement-allow.e2e
 */

import { ExperienceCertificateModel, experienceModel } from '@repo/db';
import { ExperienceService } from '@repo/service-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { drawsText } from '../helpers/pdf-text.ts';

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        // What a `-pro` subscriber's resolved set looks like: the vertical's
        // uniform keys plus the pro-only certificate key.
        ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL: {
            gastronomy: [
                actual.EntitlementKey.EDIT_GASTRONOMY_INFO,
                actual.EntitlementKey.PUBLISH_GASTRONOMY,
                actual.EntitlementKey.VIEW_BASIC_STATS
            ],
            experience: [
                actual.EntitlementKey.EDIT_EXPERIENCE_INFO,
                actual.EntitlementKey.PUBLISH_EXPERIENCE,
                actual.EntitlementKey.VIEW_BASIC_STATS,
                actual.EntitlementKey.ISSUE_EXPERIENCE_CERTIFICATE
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
const CERTIFICATE_ID = '33333333-3333-4333-8333-333333333333';

const ownerHeaders = {
    ...USER_AGENT,
    'x-mock-actor-id': OWNER_ID,
    'x-mock-actor-role': 'COMMERCE_OWNER',
    'x-mock-actor-permissions': JSON.stringify(['commerce.create', 'commerce.editOwn'])
};

const BASE = `/api/v1/protected/experiences/${LISTING_ID}/certificates`;

/** A `Result`-shaped failure, so the stubbed service call returns cleanly. */
const NOT_FOUND_RESULT = {
    data: undefined,
    error: { code: 'NOT_FOUND', message: 'listing not found' }
} as never;

/** The listing the PDF case prints from: the caller's, and PUBLIC. */
const PUBLISHED_LISTING = {
    data: {
        id: LISTING_ID,
        slug: 'pesca-en-el-rio-uruguay',
        name: 'Pesca en el río Uruguay',
        type: 'FISHING',
        visibility: 'PUBLIC',
        ownerId: OWNER_ID
    },
    error: undefined
} as never;

describe('experience certificate entitlement gate — allow side (HOS-1057)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        _resetCommerceBaseLimitCache();
    });

    it('lets an entitled owner reach the list handler', async () => {
        // The witness: the handler's first call, which runs strictly after the
        // gate. `requireEntitlement` throws before `next()`, so this having been
        // called is proof the gate let the request through.
        const witness = vi
            .spyOn(ExperienceService.prototype, 'getById')
            .mockResolvedValue(NOT_FOUND_RESULT);

        const res = await app.request(BASE, { headers: ownerHeaders });
        const body = (await res.json().catch(() => ({}))) as { error?: { code?: string } };

        expect(body.error?.code).not.toBe('ENTITLEMENT_REQUIRED');
        expect(res.status).not.toBe(403);
        expect(witness).toHaveBeenCalledTimes(1);
    });

    it('lets an entitled owner reach the issue handler', async () => {
        const witness = vi
            .spyOn(ExperienceService.prototype, 'getById')
            .mockResolvedValue(NOT_FOUND_RESULT);

        const res = await app.request(BASE, {
            method: 'POST',
            headers: { ...ownerHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipientName: 'Ana Pérez', completedAt: '2026-03-14' })
        });
        const body = (await res.json().catch(() => ({}))) as { error?: { code?: string } };

        expect(body.error?.code).not.toBe('ENTITLEMENT_REQUIRED');
        expect(res.status).not.toBe(403);
        expect(witness).toHaveBeenCalledTimes(1);
    });

    it('answers a real PDF file, end to end, naming the recipient', async () => {
        // The whole point of the feature, asserted through the real route: a
        // body a viewer opens, under a download header, with the person's name
        // actually drawn on it. The route returns a raw `Response`, so nothing
        // about this shape is validated by the schema machinery — if it were
        // broken, every test above would still pass.
        vi.spyOn(ExperienceService.prototype, 'getById').mockResolvedValue(PUBLISHED_LISTING);
        // The service-core helper re-derives ownership from the MODEL rather
        // than trusting the route — deliberate defence in depth — so the model
        // has to answer too. Stubbing only the service would 404 here, which is
        // itself the proof that the second check is real and not decorative.
        vi.spyOn(experienceModel, 'findById').mockResolvedValue({
            id: LISTING_ID,
            ownerId: OWNER_ID
        } as never);
        vi.spyOn(ExperienceCertificateModel.prototype, 'findOne').mockResolvedValue({
            id: CERTIFICATE_ID,
            experienceId: LISTING_ID,
            recipientName: 'Ana Perez',
            completedAt: '2026-03-14',
            issuedAt: new Date('2026-03-15T12:00:00.000Z')
        } as never);

        const res = await app.request(`${BASE}/${CERTIFICATE_ID}/pdf`, { headers: ownerHeaders });

        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('application/pdf');
        expect(res.headers.get('content-disposition')).toBe(
            'attachment; filename="certificado-ana-perez.pdf"'
        );

        const bytes = Buffer.from(await res.arrayBuffer());
        // The header, not the version: which PDF version comes out is the
        // renderer's business, and pinning it turns a library swap into a test
        // failure rather than a decision.
        expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
        expect(bytes.toString('latin1')).toContain('%%EOF');
        // The recipient and the experience both reached the page, so this is
        // that person's certificate rather than an empty template. Read through
        // the inflated streams: pdf-lib Flate-compresses content, so a raw-bytes
        // search would be false no matter what the sheet says.
        expect(drawsText(bytes, 'Ana Perez')).toBe(true);
        expect(drawsText(bytes, 'Pesca en el')).toBe(true);
    });
});
