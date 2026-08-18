/**
 * Persistence test for PATCH /api/v1/protected/accommodations/:id
 * (SPEC-208 conversions + SPEC-229 partial grouped objects).
 *
 * ## Why this file was rewritten (HOS-573)
 *
 * Every assertion here used to be unreachable. The suite drove the full
 * `initApp()`, authenticated with `x-mock-actor-*` headers, and guarded each
 * check with `if (!domainInput) return` — "skip if mock auth isn't wired
 * (service never called in CI)". Two things stacked up:
 *
 *  - `actorMiddleware` builds a mock actor only when ALL THREE headers are
 *    present. This suite sent two (`role` + `id`, no `permissions`), and both
 *    carried invalid values anyway: a role outside `RoleEnum` and an id that is
 *    not a UUID. The actor was never built, so every request was a 401.
 *  - The early return then turned that into a silent pass.
 *
 * The comment blamed CI, and that part was wrong: `isMockActorAllowed()` does
 * test `env.CI !== 'true'`, but `CI` is not a key of the api env schema, so
 * `env.CI` is `undefined` and the check is inert. Mock actors work in CI — this
 * suite's headers were simply malformed everywhere.
 *
 * Measured, not assumed: deleting the `httpToDomainAccommodationUpdate` call
 * from the route left all 13 tests green. The suite had been certifying SPEC-208
 * and SPEC-229 while structurally unable to fail.
 *
 * The route is now mounted on a minimal app with the actor and entitlements
 * injected directly, so authentication cannot be the thing that silently breaks
 * it again, and a request that never reaches the service is a FAILURE, not a
 * skip.
 *
 * @module test/routes/accommodation/protected/patch-persistence
 */

import { EntitlementKey } from '@repo/billing';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    clearEntityFetchers,
    registerEntityFetcher
} from '../../../../src/middlewares/ownership.js';
import { protectedPatchAccommodationRoute } from '../../../../src/routes/accommodation/protected/patch.js';
import type { AppBindings } from '../../../../src/types.js';

const ACCOMMODATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const AMENITY_UUID_1 = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
const AMENITY_UUID_2 = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2';

const HEADERS = {
    'Content-Type': 'application/json',
    // `API_VALIDATION_REQUIRED_HEADERS` defaults to user-agent; without it every
    // request short-circuits with a 400 before routing.
    'user-agent': 'vitest'
};

let updateSpy: ReturnType<typeof vi.spyOn>;

/**
 * Mounts the route with the owner as actor and the entitlements its middleware
 * chain reads off the request context. `requireEntitlement` checks
 * `userEntitlements`; the two content gates neutralize rather than reject, so a
 * plain payload passes them either way.
 */
function buildApp(): Hono<AppBindings> {
    const app = new Hono<AppBindings>();

    app.use((c, next) => {
        c.set('actor', {
            id: OWNER_ID,
            roles: [RoleEnum.HOST],
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });
        c.set('billingLoadFailed', false);
        c.set(
            'userEntitlements',
            new Set([
                EntitlementKey.EDIT_ACCOMMODATION_INFO,
                EntitlementKey.CAN_USE_RICH_DESCRIPTION
            ])
        );
        return next();
    });

    app.route('/', protectedPatchAccommodationRoute);

    return app;
}

/** Sends the PATCH and returns the domain input the service received. */
async function patch(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await buildApp().request(`/${ACCOMMODATION_ID}`, {
        method: 'PATCH',
        headers: HEADERS,
        body: JSON.stringify(body)
    });

    expect(
        updateSpy,
        `AccommodationService.update was never called — the request stopped at ${response.status}`
    ).toHaveBeenCalledTimes(1);

    return (updateSpy.mock.calls[0]?.[2] ?? {}) as Record<string, unknown>;
}

beforeEach(() => {
    registerEntityFetcher('accommodation', async () => ({
        data: { id: ACCOMMODATION_ID, ownerId: OWNER_ID }
    }));

    updateSpy = vi.spyOn(AccommodationService.prototype, 'update').mockResolvedValue({
        data: { id: ACCOMMODATION_ID, name: 'mock' }
    } as never);
});

afterEach(() => {
    clearEntityFetchers();
    vi.restoreAllMocks();
});

describe('PATCH /protected/accommodations/:id — flat to domain conversion (SPEC-208)', () => {
    it('nests latitude/longitude under location.coordinates', async () => {
        const input = await patch({ latitude: -32.47, longitude: -58.23 });

        const coords = (input.location as Record<string, unknown> | undefined)?.coordinates as
            | Record<string, unknown>
            | undefined;

        expect(coords?.lat).toBeDefined();
        expect(coords?.long).toBeDefined();
        expect(Object.keys(input)).not.toContain('latitude');
        expect(Object.keys(input)).not.toContain('longitude');
    });

    it('nests basePrice/currency under price', async () => {
        const input = await patch({ basePrice: 15000, currency: 'ARS' });

        const price = input.price as Record<string, unknown> | undefined;

        expect(price?.price).toBe(15000);
        expect(price?.currency).toBe('ARS');
        expect(Object.keys(input)).not.toContain('basePrice');
    });

    it('nests the contact fields under contactInfo', async () => {
        const input = await patch({
            phone: '+5493435551234',
            email: 'host@hotel.com',
            website: 'https://hotel.com'
        });

        const contact = input.contactInfo as Record<string, unknown> | undefined;

        expect(contact?.mobilePhone).toBe('+5493435551234');
        expect(contact?.personalEmail).toBe('host@hotel.com');
        expect(contact?.website).toBe('https://hotel.com');
        expect(Object.keys(input)).not.toContain('phone');
        expect(Object.keys(input)).not.toContain('email');
    });

    it('nests the social fields under socialNetworks', async () => {
        const input = await patch({
            facebook: 'https://facebook.com/hotel',
            instagram: 'https://instagram.com/hotel'
        });

        const social = input.socialNetworks as Record<string, unknown> | undefined;

        expect(social?.facebook).toBe('https://facebook.com/hotel');
        expect(social?.instagram).toBe('https://instagram.com/hotel');
        expect(Object.keys(input)).not.toContain('facebook');
    });

    it('nests maxGuests/bedrooms/bathrooms under extraInfo', async () => {
        const input = await patch({ maxGuests: 6, bedrooms: 3, bathrooms: 2 });

        const extra = input.extraInfo as Record<string, unknown> | undefined;

        expect(extra?.capacity).toBe(6);
        expect(extra?.bedrooms).toBe(3);
        expect(extra?.bathrooms).toBe(2);
        expect(Object.keys(input)).not.toContain('maxGuests');
    });

    it('passes amenityIds and featureIds straight through', async () => {
        const input = await patch({
            amenityIds: [AMENITY_UUID_1, AMENITY_UUID_2],
            featureIds: [AMENITY_UUID_1]
        });

        expect(input.amenityIds).toEqual([AMENITY_UUID_1, AMENITY_UUID_2]);
        expect(input.featureIds).toEqual([AMENITY_UUID_1]);
    });

    it('passes summary straight through', async () => {
        const input = await patch({ summary: 'A short summary text here' });

        expect(input.summary).toBe('A short summary text here');
    });

    it.each([
        'featuredImage',
        'gallery'
    ])('rejects media.%s, which is not updatable here', async (key) => {
        // This replaces a test asserting the OPPOSITE: that featuredImage and
        // gallery were converted with `moderationState` defaulting to APPROVED
        // (SPEC-208). HOS-372 moved photos to the relational
        // `accommodation_media` table and made both keys an explicit
        // `zodError.accommodation.media.photosNotUpdatable` rejection, so that
        // payload stopped being valid. Nobody noticed because the suite's escape
        // hatch swallowed the 400. Videos remain the only updatable media here.
        const value =
            key === 'gallery'
                ? [{ url: 'https://example.com/gallery1.jpg' }]
                : { url: 'https://example.com/hero.jpg' };

        const response = await buildApp().request(`/${ACCOMMODATION_ID}`, {
            method: 'PATCH',
            headers: HEADERS,
            body: JSON.stringify({ media: { [key]: value } })
        });

        expect(response.status).toBe(400);
        expect(updateSpy).not.toHaveBeenCalled();
    });
});

/**
 * A single-field PATCH of a grouped column must reach the service as a PARTIAL
 * object carrying ONLY the sent key, with no synthetic defaults, so the DB
 * shallow-merge preserves the untouched siblings. Before SPEC-229 a lone
 * `currency` produced no `price` at all, and a lone `bedrooms` was dropped
 * because `extraInfo` demanded all three plus injected `minNights` /
 * `smokingAllowed`.
 */
describe('PATCH /protected/accommodations/:id — partial grouped objects (SPEC-229)', () => {
    it('emits a price carrying only currency when basePrice is absent', async () => {
        const price = (await patch({ currency: 'USD' })).price as
            | Record<string, unknown>
            | undefined;

        expect(price).toBeDefined();
        expect(price?.currency).toBe('USD');
        expect(price && 'price' in price).toBe(false);
    });

    it('emits an extraInfo carrying only bedrooms, with no injected defaults', async () => {
        const extra = (await patch({ bedrooms: 8 })).extraInfo as
            | Record<string, unknown>
            | undefined;

        expect(extra).toBeDefined();
        expect(extra?.bedrooms).toBe(8);
        expect(extra && 'capacity' in extra).toBe(false);
        expect(extra && 'minNights' in extra).toBe(false);
        expect(extra && 'smokingAllowed' in extra).toBe(false);
    });

    it('emits a contactInfo carrying only website, without an empty mobilePhone', async () => {
        const contact = (await patch({ website: 'https://hotel.com' })).contactInfo as
            | Record<string, unknown>
            | undefined;

        expect(contact).toBeDefined();
        expect(contact?.website).toBe('https://hotel.com');
        expect(contact && 'mobilePhone' in contact).toBe(false);
    });
});
