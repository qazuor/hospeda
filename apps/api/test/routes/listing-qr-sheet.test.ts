/**
 * The three printable QR sheet routes, executed (HOS-982).
 *
 * ---
 * WHY THIS FILE EXISTS
 *
 * It did not, and the three route files each claimed it did: every one carried
 * `Exported standalone so the route test can call it directly` over a handler
 * no test had ever run. The whole authorisation surface — ownership, the staff
 * bypass, the publication check, and the `ServiceError` class identity that
 * decides whether a refusal is a 404 or a 500 — was reachable only in
 * production.
 *
 * The anti-enumeration half (a foreign listing must be indistinguishable from
 * an invented one) lives with its siblings in
 * `existence-disclosure.paired-probe.test.ts`. What is here is everything else:
 * the 200 with real bytes, the two ways a listing can fail to be published, the
 * staff bypass, and — the finding that started this — what locale gets written
 * into the minted `qr_codes` row.
 *
 * ## Why the app is one mounted route rather than `initApp()`
 *
 * Same reason the paired probe does it: the sheet routes need the REAL
 * `ServiceError`, and `test/setup.ts` replaces `@repo/service-core` wholesale
 * with hand-written fakes whose `ServiceError` is a different class — under
 * which `handleRouteError`'s `instanceof` fails and every refusal becomes a 500.
 * The file-local `vi.mock` below restores the real module; `@repo/db` stays
 * mocked, which is fine because the only service call that would reach it is
 * stubbed here.
 *
 * @module test/routes/listing-qr-sheet
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Must come before any import of the package. Restores the real service-core
// for this file only.
vi.mock(
    '@repo/service-core',
    async (importOriginal) => await importOriginal<Record<string, unknown>>()
);

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import {
    AccommodationService,
    ExperienceService,
    GastronomyService,
    QrCodeService
} from '@repo/service-core';
import { Hono } from 'hono';
import type { AppBindings } from '../../src/types';
import { drawsText } from '../helpers/pdf-text.ts';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const LISTING_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_OWNER_ID = '44444444-4444-4444-8444-444444444444';

/** The slug of the `qr_codes` row the stub hands back. */
const QR_SLUG = 'K7Qm2XbT';

/** `HOSPEDA_SITE_URL` as `test/setup.ts` sets it. */
const SITE = 'http://localhost:4321';

const ownerActor = {
    id: OWNER_ID,
    roles: [RoleEnum.USER] as readonly RoleEnum[],
    permissions: [] as PermissionEnum[]
};

/** A published listing of the caller's, with every field the routes read. */
function publishedListing(overrides: Record<string, unknown> = {}) {
    return {
        id: LISTING_ID,
        ownerId: OWNER_ID,
        name: 'La Parrilla del Puerto',
        slug: 'la-parrilla-del-puerto',
        lifecycleState: 'ACTIVE',
        visibility: 'PUBLIC',
        ...overrides
    };
}

/**
 * Mounts one route with `actor` injected, exactly as the paired probe does. No
 * error handler is attached: `createProtectedRoute` catches inside the factory
 * and formats through the REAL `handleRouteError`, so what these tests read is
 * the answer production sends.
 */
function buildApp(
    route: ReturnType<typeof import('../../src/utils/create-app.js').createRouter>,
    actor: unknown = ownerActor
): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.use((c, next) => {
        c.set('actor', actor as never);
        return next();
    });
    app.route('/', route);
    return app;
}

// ---------------------------------------------------------------------------
// The three verticals
// ---------------------------------------------------------------------------

const CASES = [
    {
        label: 'accommodation',
        service: AccommodationService,
        /** The permission that lets staff download somebody else's sheet. */
        staffPermission: PermissionEnum.ACCOMMODATION_UPDATE_ANY,
        /** The path segment the minted destination must carry. */
        segment: 'alojamientos',
        importRoute: async () => {
            const mod = await import('../../src/routes/accommodation/protected/qrSheet.js');
            return mod.protectedGetAccommodationQrSheetRoute;
        }
    },
    {
        label: 'gastronomy',
        service: GastronomyService,
        staffPermission: PermissionEnum.COMMERCE_VIEW_ALL,
        segment: 'gastronomia',
        importRoute: async () => {
            const mod = await import('../../src/routes/gastronomy/protected/qrSheet.js');
            return mod.protectedGetGastronomyQrSheetRoute;
        }
    },
    {
        label: 'experience',
        service: ExperienceService,
        staffPermission: PermissionEnum.COMMERCE_VIEW_ALL,
        segment: 'experiencias',
        importRoute: async () => {
            const mod = await import('../../src/routes/experience/protected/qrSheet.js');
            return mod.protectedGetExperienceQrSheetRoute;
        }
    }
] as const;

/** Captures every `getOrCreateForEntity` call, so the minted row is inspectable. */
let mintSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    mintSpy = vi
        .spyOn(QrCodeService.prototype, 'getOrCreateForEntity')
        .mockResolvedValue({ data: { slug: QR_SLUG } } as never);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe.each(CASES)('GET /protected/$label/:id/qr-sheet (HOS-982)', ({
    service,
    staffPermission,
    segment,
    importRoute
}) => {
    function stubListing(overrides: Record<string, unknown> = {}) {
        return vi
            .spyOn(service.prototype, 'getById')
            .mockResolvedValue({ data: publishedListing(overrides) } as never);
    }

    it('answers a real PDF for the owner of a published listing', async () => {
        stubListing();
        const res = await buildApp(await importRoute()).request(`/${LISTING_ID}/qr-sheet`);

        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('application/pdf');
        expect(res.headers.get('content-disposition')).toBe(
            'attachment; filename="qr-la-parrilla-del-puerto.pdf"'
        );

        const bytes = Buffer.from(await res.arrayBuffer());
        expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
        // The listing's OWN name reached the page, so this is that
        // listing's sheet rather than an empty template.
        expect(drawsText(bytes, 'La Parrilla del Puerto')).toBe(true);
    });

    it('mints ONE code, for this entity and the LISTING purpose', async () => {
        stubListing();
        await buildApp(await importRoute()).request(`/${LISTING_ID}/qr-sheet`);

        expect(mintSpy).toHaveBeenCalledTimes(1);
        const minted = mintSpy.mock.calls[0]?.[0] as { entityId: string; purpose: string };
        expect(minted.entityId).toBe(LISTING_ID);
        // Not BROCHURE, not CERTIFICATE, not MENU: those are live rows for
        // the same subject and handing one document another's code splits
        // its scan counts.
        expect(minted.purpose).toBe('LISTING');
    });

    it('refuses a listing that is not PUBLIC', async () => {
        stubListing({ visibility: 'PRIVATE' });
        const res = await buildApp(await importRoute()).request(`/${LISTING_ID}/qr-sheet`);

        expect(res.status).toBe(404);
        expect(res.headers.get('content-type')).not.toBe('application/pdf');
        // And nothing was written: a refused download must not leave a live
        // `qr_codes` row behind for a page that does not exist.
        expect(mintSpy).not.toHaveBeenCalled();
    });

    it('refuses a listing that is PUBLIC but not ACTIVE', async () => {
        // The admin schemas accept `lifecycleState` on its own, so this row
        // is reachable: a staff PATCH to INACTIVE that leaves `visibility`
        // standing. The public read answers NOT_FOUND for it, so a sheet
        // printed here would 404 on every scan, permanently, on paper.
        stubListing({ lifecycleState: 'INACTIVE' });
        const res = await buildApp(await importRoute()).request(`/${LISTING_ID}/qr-sheet`);

        expect(res.status).toBe(404);
        expect(res.headers.get('content-type')).not.toBe('application/pdf');
        expect(mintSpy).not.toHaveBeenCalled();
    });

    it('refuses a listing that belongs to somebody else', async () => {
        stubListing({ ownerId: OTHER_OWNER_ID });
        const res = await buildApp(await importRoute()).request(`/${LISTING_ID}/qr-sheet`);

        // 404 and not 403: a 403 would confirm the id exists. The body is
        // compared byte for byte against an invented id in
        // `existence-disclosure.paired-probe.test.ts`.
        expect(res.status).toBe(404);
        expect(mintSpy).not.toHaveBeenCalled();
    });

    it('lets staff download a listing that is not theirs', async () => {
        stubListing({ ownerId: OTHER_OWNER_ID });
        const staff = { ...ownerActor, permissions: [staffPermission] };
        const res = await buildApp(await importRoute(), staff).request(`/${LISTING_ID}/qr-sheet`);

        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('application/pdf');
    });

    it('answers 404, never 500, when the service says the row is missing', async () => {
        // The class-identity trap this feature is one import away from:
        // each route takes `ServiceError` from `@repo/service-core/types`
        // and `entityNotFoundError` from the package ROOT. Should those two
        // module instances ever diverge, `handleRouteError`'s `instanceof`
        // fails and this becomes a 500 — on a path nothing else executes.
        vi.spyOn(service.prototype, 'getById').mockResolvedValue({
            error: { code: 'NOT_FOUND', message: `${service.ENTITY_NAME} not found` }
        } as never);

        const res = await buildApp(await importRoute()).request(`/${LISTING_ID}/qr-sheet`);
        const body = (await res.json()) as { error?: { code?: string } };

        expect(res.status).toBe(404);
        expect(body.error?.code).toBe('NOT_FOUND');
    });

    /**
     * The finding, at the level where it actually bites: `qr_codes.targetUrl`
     * is creation-only, so whatever the FIRST download writes is where every
     * scan of that sheet lands for the rest of its life.
     */
    it('prints in the reader’s language but mints in the market’s', async () => {
        stubListing();
        const res = await buildApp(await importRoute()).request(`/${LISTING_ID}/qr-sheet`, {
            headers: { 'accept-language': 'en-US,en;q=0.9' }
        });

        expect(res.status).toBe(200);

        // The paper follows the host who downloaded it...
        const bytes = Buffer.from(await res.arrayBuffer());
        expect(drawsText(bytes, 'Scan the code')).toBe(true);

        // ...and the destination does NOT. An English `targetUrl` here
        // would send every future passer-by who scans that door to the
        // English page, permanently, and a Spanish re-download would not
        // undo it — the row already exists.
        const minted = mintSpy.mock.calls[0]?.[0] as { targetUrl: string };
        expect(minted.targetUrl).toBe(`${SITE}/es/${segment}/la-parrilla-del-puerto/`);
    });
});
