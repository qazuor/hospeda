/**
 * Persistence test for PUT /api/v1/protected/accommodations/:id (HOS-573).
 *
 * ## What this covers that nothing else did
 *
 * `patch-persistence.test.ts` claims to prove the PATCH on this resource
 * converts a flat HTTP body into domain shape before calling the service
 * (SPEC-208). The PUT never got the same treatment: it forwards the raw body
 * straight to `AccommodationService.update`.
 *
 * That matters more here than it did for events (H-30).
 * `AccommodationUpdateInputSchema` is NOT `.strict()`, so Zod silently DROPS
 * every key the domain does not know — `latitude`, `basePrice`, `phone`,
 * `facebook`, `maxGuests`, `media` — and the response is a `200`. An owner edits
 * their address, price, phone, socials, capacity or photos, sees "saved", and
 * nothing was written. There is no error to notice: the symptom is the absence
 * of a symptom.
 *
 * ## Why this does not reuse the PATCH suite's harness
 *
 * That suite drives the full `initApp()` and authenticates with `x-mock-actor-*`
 * headers, and it guards every assertion with `if (!domainInput) return` —
 * "skip if mock auth isn't wired (service never called in CI)". Three things
 * make that harness unable to fail:
 *
 *  - `isMockActorAllowed()` requires `CI !== 'true'`, so mock actors are OFF in
 *    CI by design and every request there is a 401.
 *  - The middleware needs all THREE headers; that suite sends two, so the actor
 *    is never built locally either.
 *  - The early return then turns both into a silent pass. Deleting the mapper
 *    call from the PATCH route leaves all 13 of its tests green — measured, not
 *    assumed.
 *
 * So this file mounts the route on a minimal app and injects the actor,
 * entitlements and entity fetcher directly. No mock-actor headers, nothing that
 * behaves differently in CI, and a request that never reaches the service is a
 * FAILURE rather than a skip.
 *
 * @module test/routes/accommodation/protected/update-persistence
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
import { protectedUpdateAccommodationRoute } from '../../../../src/routes/accommodation/protected/update.js';
import type { AppBindings } from '../../../../src/types.js';

const ACCOMMODATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';

const HEADERS = {
    'Content-Type': 'application/json',
    // `API_VALIDATION_REQUIRED_HEADERS` defaults to user-agent; without it every
    // request short-circuits with a 400 before routing.
    'user-agent': 'vitest'
};

let updateSpy: ReturnType<typeof vi.spyOn>;

/**
 * Mounts the route with the owner resolved as actor and the entitlement the
 * route's `requireEntitlement` guard demands already in context — that guard
 * reads `userEntitlements` off the request, so seeding it needs no mocking.
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
        c.set('userEntitlements', new Set([EntitlementKey.EDIT_ACCOMMODATION_INFO]));
        return next();
    });

    app.route('/', protectedUpdateAccommodationRoute);

    return app;
}

/** Sends a PUT and returns the domain input the service received. */
async function put(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await buildApp().request(`/${ACCOMMODATION_ID}`, {
        method: 'PUT',
        headers: HEADERS,
        body: JSON.stringify(body)
    });

    // A request that never reaches the service proves nothing, and passing here
    // silently is exactly how a data-loss bug stays invisible.
    expect(
        updateSpy,
        `AccommodationService.update was never called — the request stopped at ${response.status}`
    ).toHaveBeenCalledTimes(1);

    return (updateSpy.mock.calls[0]?.[2] ?? {}) as Record<string, unknown>;
}

beforeEach(() => {
    // The ownership middleware resolves the entity through an injectable
    // fetcher, so no database is involved. It returns a Result envelope, not the
    // bare entity.
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

describe('PUT /protected/accommodations/:id — flat to domain conversion (HOS-573)', () => {
    it('nests latitude/longitude under location.coordinates', async () => {
        const input = await put({ latitude: -32.47, longitude: -58.23 });

        const coords = (input.location as Record<string, unknown> | undefined)?.coordinates as
            | Record<string, unknown>
            | undefined;

        expect(coords?.lat).toBeDefined();
        expect(coords?.long).toBeDefined();
        expect(Object.keys(input)).not.toContain('latitude');
        expect(Object.keys(input)).not.toContain('longitude');
    });

    it('nests basePrice/currency under price', async () => {
        const input = await put({ basePrice: 15000, currency: 'ARS' });

        const price = input.price as Record<string, unknown> | undefined;

        expect(price?.price).toBe(15000);
        expect(price?.currency).toBe('ARS');
        expect(Object.keys(input)).not.toContain('basePrice');
    });

    it('nests the contact fields under contactInfo', async () => {
        const input = await put({
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
        const input = await put({
            facebook: 'https://facebook.com/hotel',
            instagram: 'https://instagram.com/hotel'
        });

        const social = input.socialNetworks as Record<string, unknown> | undefined;

        expect(social?.facebook).toBe('https://facebook.com/hotel');
        expect(social?.instagram).toBe('https://instagram.com/hotel');
        expect(Object.keys(input)).not.toContain('facebook');
    });

    it('nests maxGuests/bedrooms/bathrooms under extraInfo', async () => {
        const input = await put({ maxGuests: 6, bedrooms: 3, bathrooms: 2 });

        const extra = input.extraInfo as Record<string, unknown> | undefined;

        expect(extra?.capacity).toBe(6);
        expect(extra?.bedrooms).toBe(3);
        expect(extra?.bathrooms).toBe(2);
        expect(Object.keys(input)).not.toContain('maxGuests');
    });

    it('still forwards the fields whose names already match the domain', async () => {
        // The control, and the reason the bug reads as "saving works": these are
        // the only keys that survived, because HTTP and domain spell them alike.
        const input = await put({ name: 'A perfectly fine accommodation name' });

        expect(input.name).toBe('A perfectly fine accommodation name');
    });
});
