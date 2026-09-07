/**
 * The three listing-QR image routes, executed (HOS-982 PR 2).
 *
 * ---
 * WHAT THIS FILE IS FOR
 *
 * `GET /protected/<vertical>/{id}/qr` exists so the owner can SEE the code
 * before downloading the sheet — the web app's CSP forbids embedding the PDF and
 * the repo forbids a second QR generator, so the symbol has to come from here.
 *
 * The property that matters most is not any single response: it is that this
 * route hands back **the same code the printed sheet carries**. `qr_codes` is
 * keyed on `(entity_type, entity_id, purpose)`, so a divergence in any of the
 * three produces two live codes for one listing — one on screen, a different one
 * on the door — with the listing's scan counts split between them, and NOTHING
 * fails: both routes answer 200, both symbols scan. `mints the SAME code the
 * printable sheet mints` below is the assertion that sees it, by executing both
 * routes and comparing the two `getOrCreateForEntity` calls argument for
 * argument. `test/utils/entity-qr-purpose.guard.test.ts` is its static half.
 *
 * ## Why the app is one mounted route rather than `initApp()`
 *
 * Same reason as `listing-qr-sheet.test.ts`: these routes need the REAL
 * `ServiceError`, and `test/setup.ts` replaces `@repo/service-core` wholesale
 * with fakes whose `ServiceError` is a different class — under which
 * `handleRouteError`'s `instanceof` fails and every refusal becomes a 500. The
 * file-local `vi.mock` below restores the real module; `@repo/db` stays mocked,
 * which is fine because the only service call that would reach it is stubbed.
 *
 * @module test/routes/listing-qr-code
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
import { renderQrSvg } from '../../src/utils/qr-render';

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
 * Mounts one route with `actor` injected. No error handler is attached:
 * `createProtectedRoute` catches inside the factory and formats through the REAL
 * `handleRouteError`, so what these tests read is the answer production sends.
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
        /** The permission that lets staff read somebody else's code. */
        staffPermission: PermissionEnum.ACCOMMODATION_UPDATE_ANY,
        /** The path segment the minted destination must carry. */
        segment: 'alojamientos',
        importRoute: async () => {
            const mod = await import('../../src/routes/accommodation/protected/qrCode.js');
            return mod.protectedGetAccommodationQrCodeRoute;
        },
        importSheetRoute: async () => {
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
            const mod = await import('../../src/routes/gastronomy/protected/qrCode.js');
            return mod.protectedGetGastronomyQrCodeRoute;
        },
        importSheetRoute: async () => {
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
            const mod = await import('../../src/routes/experience/protected/qrCode.js');
            return mod.protectedGetExperienceQrCodeRoute;
        },
        importSheetRoute: async () => {
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

describe.each(CASES)('GET /protected/$label/:id/qr (HOS-982)', ({
    service,
    staffPermission,
    segment,
    importRoute,
    importSheetRoute
}) => {
    function stubListing(overrides: Record<string, unknown> = {}) {
        return vi
            .spyOn(service.prototype, 'getById')
            .mockResolvedValue({ data: publishedListing(overrides) } as never);
    }

    it('answers the symbol, and the symbol encodes the URL it reports', async () => {
        stubListing();
        const res = await buildApp(await importRoute()).request(`/${LISTING_ID}/qr`);

        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            data: { svg: string; url: string; slug: string };
        };

        // The platform's own redirect, never the ficha: a printed code that
        // encodes its final destination cannot be corrected and its scans
        // cannot be counted (HOS-981).
        expect(body.data.url).toBe(`${SITE}/qr/${QR_SLUG}/`);
        expect(body.data.slug).toBe('la-parrilla-del-puerto');

        // Byte equality against a render of the URL the route itself reported.
        // `renderQrSvg` is deterministic for a given data+options pair, so this
        // is what rules out the case the eye cannot check: a well-formed symbol
        // that encodes something ELSE than the `url` beside it.
        expect(body.data.svg).toBe(await renderQrSvg({ data: body.data.url }));
        expect(body.data.svg.startsWith('<svg')).toBe(true);
    });

    it('mints the SAME code the printable sheet mints', async () => {
        stubListing();

        await buildApp(await importRoute()).request(`/${LISTING_ID}/qr`);
        await buildApp(await importSheetRoute()).request(`/${LISTING_ID}/qr-sheet`);

        expect(mintSpy).toHaveBeenCalledTimes(2);
        const fromPanel = mintSpy.mock.calls[0]?.[0];
        const fromSheet = mintSpy.mock.calls[1]?.[0];

        // Whole-object equality, not a field-by-field spot check:
        // `(entityType, entityId, purpose)` is the lookup key, so a difference
        // there is a SECOND code — one QR on the door and another on the
        // counter, with the scan counts split. `targetUrl` and `label` are
        // creation-only, so a difference there means whichever route ran first
        // silently decided them for the other; since the panel renders before
        // anybody downloads, that would be this route deciding what the sheet
        // prints. `objectContaining` would be blind to a field one side lacks.
        expect(fromPanel).toStrictEqual(fromSheet);
    });

    it('mints ONE code, for this entity and the LISTING purpose', async () => {
        stubListing();
        await buildApp(await importRoute()).request(`/${LISTING_ID}/qr`);

        expect(mintSpy).toHaveBeenCalledTimes(1);
        const minted = mintSpy.mock.calls[0]?.[0] as {
            entityId: string;
            purpose: string;
            targetUrl: string;
        };
        expect(minted.entityId).toBe(LISTING_ID);
        // Not BROCHURE, not CERTIFICATE, not MENU: those are live rows for the
        // same subject and handing one surface another's code merges their
        // scan counts.
        expect(minted.purpose).toBe('LISTING');
        // Pinned to the market locale, never the caller's — the row is
        // creation-only, so an `en` destination written here would send every
        // future scanner of that door to the English page forever.
        expect(minted.targetUrl).toBe(`${SITE}/es/${segment}/la-parrilla-del-puerto/`);
    });

    it('refuses a listing that is not PUBLIC', async () => {
        stubListing({ visibility: 'PRIVATE' });
        const res = await buildApp(await importRoute()).request(`/${LISTING_ID}/qr`);

        expect(res.status).toBe(404);
        // And nothing was written: a refused read must not leave a live
        // `qr_codes` row behind for a page that does not exist.
        expect(mintSpy).not.toHaveBeenCalled();
    });

    it('refuses a listing that is PUBLIC but not ACTIVE', async () => {
        // Reachable: the admin schemas accept `lifecycleState` on its own, so a
        // staff PATCH to INACTIVE can leave `visibility` standing. The public
        // read answers NOT_FOUND for that row, so its code would 404 on every
        // scan — and this route is what puts the code on the owner's screen as
        // if it worked.
        stubListing({ lifecycleState: 'INACTIVE' });
        const res = await buildApp(await importRoute()).request(`/${LISTING_ID}/qr`);

        expect(res.status).toBe(404);
        expect(mintSpy).not.toHaveBeenCalled();
    });

    it('refuses a listing that belongs to somebody else', async () => {
        stubListing({ ownerId: OTHER_OWNER_ID });
        const res = await buildApp(await importRoute()).request(`/${LISTING_ID}/qr`);

        // 404 and not 403: a 403 would confirm the id exists. The body is
        // compared byte for byte against an invented id in
        // `existence-disclosure.paired-probe.test.ts`.
        expect(res.status).toBe(404);
        // Nobody may mint a `qr_codes` row against somebody else's listing.
        expect(mintSpy).not.toHaveBeenCalled();
    });

    it('lets staff read a listing that is not theirs', async () => {
        stubListing({ ownerId: OTHER_OWNER_ID });
        const staff = { ...ownerActor, permissions: [staffPermission] };
        const res = await buildApp(await importRoute(), staff).request(`/${LISTING_ID}/qr`);

        expect(res.status).toBe(200);
    });

    it('answers 404, never 500, when the service says the row is missing', async () => {
        // The class-identity trap this feature is one import away from: the
        // route takes `ServiceError` from `@repo/service-core/types` and
        // `entityNotFoundError` from the package ROOT. Should those two module
        // instances diverge, `handleRouteError`'s `instanceof` fails and this
        // becomes a 500.
        vi.spyOn(service.prototype, 'getById').mockResolvedValue({
            error: { code: 'NOT_FOUND', message: `${service.ENTITY_NAME} not found` }
        } as never);

        const res = await buildApp(await importRoute()).request(`/${LISTING_ID}/qr`);
        const body = (await res.json()) as { error?: { code?: string } };

        expect(res.status).toBe(404);
        expect(body.error?.code).toBe('NOT_FOUND');
    });
});
