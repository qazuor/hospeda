/**
 * Regression suite for H-129 — "turning one switch on turns the other one off".
 *
 * ## The mechanism
 *
 * `showLink` and `showReviews` are declared with `.default(false)`. In Zod 4,
 * `.partial()` does NOT suppress a default: an absent key still materialises.
 *
 * ```
 * base.partial().parse({ showLink: true })
 * // → { showLink: true, showReviews: false }   ← showReviews was never sent
 * ```
 *
 * That parsed object is spread straight into `listingModel.update()`, which
 * issues a literal SQL `SET` of every key present. The owner UI sends exactly
 * one field per toggle (`{ [field]: !current }`), so switching one visibility
 * flag silently switched the other one off — and the optimistic UI kept both
 * boxes ticked, so nothing on screen contradicted it.
 *
 * ## Why the old tests could not see it
 *
 * Every existing `update` test mocks `listingModel.update` with a canned return
 * value and asserts only on that return value. The mock ignores its argument
 * entirely, so the corrupted payload was never observed. These tests therefore
 * assert on **the argument handed to the model**, which is the only place the
 * damage is visible before it reaches Postgres.
 */

import type { AccommodationExternalListing } from '@repo/schemas';
import {
    ExternalPlatformEnum,
    LifecycleStatusEnum,
    PermissionEnum,
    UpdateAccommodationExternalListingSchema
} from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { AccommodationExternalListingService } from '../../src/services/accommodation-external-reputation/accommodation-external-listing.service.js';
import type { Actor, ServiceConfig } from '../../src/types/index.js';

const ACC_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const LIST_ID = '22222222-2222-4222-8222-222222222222';

const ctx: ServiceConfig = { logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } } as never;

function makeOwnerActor(): Actor {
    return {
        id: OWNER_ID,
        role: 'HOST',
        permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
    } as never;
}

/** A listing already configured with BOTH switches on — the state at risk. */
function makeListing(
    overrides: Partial<AccommodationExternalListing> = {}
): AccommodationExternalListing {
    return {
        id: LIST_ID,
        accommodationId: ACC_ID,
        platform: ExternalPlatformEnum.GOOGLE,
        url: 'https://www.google.com/maps/place/Cheroga+Casa+Quinta/@-32.48,-58.36,17z',
        externalId: null,
        showLink: true,
        showReviews: true,
        verified: false,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        createdById: OWNER_ID,
        updatedById: OWNER_ID,
        deletedById: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        deletedAt: null,
        ...overrides
    };
}

describe('H-129 — a partial PATCH must not overwrite fields it did not send', () => {
    describe('at the schema boundary', () => {
        it('does not materialise showReviews when only showLink is sent', () => {
            const parsed = UpdateAccommodationExternalListingSchema.parse({ showLink: true });

            expect(parsed).toEqual({ showLink: true });
            expect(Object.hasOwn(parsed, 'showReviews')).toBe(false);
        });

        it('does not materialise showLink when only showReviews is sent', () => {
            const parsed = UpdateAccommodationExternalListingSchema.parse({ showReviews: true });

            expect(parsed).toEqual({ showReviews: true });
            expect(Object.hasOwn(parsed, 'showLink')).toBe(false);
        });

        it('does not materialise either flag when only the URL is edited', () => {
            const parsed = UpdateAccommodationExternalListingSchema.parse({
                url: 'https://www.google.com/maps/place/Otro+Lugar/@-32.1,-58.1,17z'
            });

            expect(Object.hasOwn(parsed, 'showLink')).toBe(false);
            expect(Object.hasOwn(parsed, 'showReviews')).toBe(false);
        });

        it('still accepts an explicit false — absence and `false` are different', () => {
            const parsed = UpdateAccommodationExternalListingSchema.parse({ showLink: false });

            expect(parsed).toEqual({ showLink: false });
        });
    });

    describe('at the write boundary — what the model is actually told to SET', () => {
        /**
         * Runs `update` with `patch` and returns the object the service handed
         * to `listingModel.update()`.
         */
        async function capturePayload(
            patch: Record<string, unknown>
        ): Promise<Record<string, unknown>> {
            const update = vi.fn().mockResolvedValue(makeListing());
            const listingModel = {
                findById: vi.fn().mockResolvedValue(makeListing()),
                update
            };
            const accommodationModel = {
                findById: vi.fn().mockResolvedValue({
                    id: ACC_ID,
                    ownerId: OWNER_ID,
                    deletedAt: null,
                    showExternalReputation: true
                })
            };
            const svc = new AccommodationExternalListingService(
                ctx,
                listingModel as never,
                accommodationModel as never
            );

            const result = await svc.update(makeOwnerActor(), LIST_ID, patch as never);
            expect(result.error).toBeUndefined();

            expect(update).toHaveBeenCalledTimes(1);
            // Signature is `update(where, data, tx?)` — the SET payload is arg 1.
            // (Taking the LAST argument instead picks up the `undefined` tx.)
            const payload = (update.mock.calls[0] as unknown[])[1];
            expect(payload).toBeTypeOf('object');
            return payload as Record<string, unknown>;
        }

        it('omits showReviews from the SET when the owner only toggled showLink', async () => {
            const payload = await capturePayload({ showLink: false });

            // This is the assertion that fails on the unfixed code: the payload
            // carried `showReviews: false`, silently un-publishing the reviews
            // block for an owner who only touched the link switch.
            expect(Object.hasOwn(payload, 'showReviews')).toBe(false);
            expect(payload.showLink).toBe(false);
        });

        it('omits showLink from the SET when the owner only toggled showReviews', async () => {
            const payload = await capturePayload({ showReviews: false });

            expect(Object.hasOwn(payload, 'showLink')).toBe(false);
            expect(payload.showReviews).toBe(false);
        });

        it('omits both flags from the SET when the owner only edited the URL', async () => {
            const payload = await capturePayload({
                url: 'https://www.google.com/maps/place/Otro+Lugar/@-32.1,-58.1,17z'
            });

            expect(Object.hasOwn(payload, 'showLink')).toBe(false);
            expect(Object.hasOwn(payload, 'showReviews')).toBe(false);
        });

        it('still writes both flags when the caller genuinely sends both', async () => {
            const payload = await capturePayload({ showLink: true, showReviews: true });

            expect(payload.showLink).toBe(true);
            expect(payload.showReviews).toBe(true);
        });
    });
});
