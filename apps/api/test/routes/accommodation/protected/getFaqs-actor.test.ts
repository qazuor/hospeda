/**
 * @file getFaqs-actor.test.ts
 * @description Regression test for HOS-786.
 *
 * `GET /api/v1/protected/accommodations/:id/faqs` was a copy of the public
 * route: its handler called `createGuestActor()` instead of reading the
 * authenticated actor from the request context. Every SSR read therefore
 * reached `_canView` as a GUEST, and a DRAFT/PRIVATE accommodation answered
 * NOT_FOUND — the owner's own FAQ panel rendered an empty list no matter which
 * session cookie the web app forwarded.
 *
 * The assertion below is on the ACTOR the route hands to the service, because
 * that is the exact thing that regressed. `@repo/db` is globally mocked in
 * `test/setup.ts`, so a data-level assertion here would be vacuous.
 *
 * @module test/routes/accommodation/protected/getFaqs-actor
 */

import { RoleEnum } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../../src/app';
import { createAuthenticatedRequest, createMockUserActor } from '../../../helpers/auth';

const OWNER_ID = '3f1c9a10-5f5e-4c9b-9a2f-1d7c8e4b6a90';
const ACCOMMODATION_ID = 'd610cd16-abaa-4834-8279-e0b13e3ac44e';
const FAQS_URL = `/api/v1/protected/accommodations/${ACCOMMODATION_ID}/faqs`;

/** The fixed id `createGuestActor()` stamps on every anonymous actor. */
const GUEST_ACTOR_ID = '00000000-0000-4000-8000-000000000000';

describe('GET /api/v1/protected/accommodations/:id/faqs — actor resolution (HOS-786)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('hands the authenticated session actor to the service, never a fabricated guest', async () => {
        // Arrange
        const getFaqs = vi
            .spyOn(AccommodationService.prototype, 'getFaqs')
            .mockResolvedValue({ data: { faqs: [] }, error: undefined } as never);
        const owner = createMockUserActor({ id: OWNER_ID });
        const app = await initApp();

        // Act
        const res = await app.request(FAQS_URL, {
            method: 'GET',
            ...createAuthenticatedRequest(owner)
        });

        // Assert
        expect(res.status).toBe(200);
        expect(getFaqs).toHaveBeenCalledOnce();

        const actorArg = getFaqs.mock.calls[0]?.[0];
        expect(actorArg?.id).toBe(OWNER_ID);
        expect(actorArg?.id).not.toBe(GUEST_ACTOR_ID);
        expect(actorArg?.roles).not.toContain(RoleEnum.GUEST);
    });

    it('forwards the accommodation id the caller asked for', async () => {
        // Arrange
        const getFaqs = vi
            .spyOn(AccommodationService.prototype, 'getFaqs')
            .mockResolvedValue({ data: { faqs: [] }, error: undefined } as never);
        const owner = createMockUserActor({ id: OWNER_ID });
        const app = await initApp();

        // Act
        await app.request(FAQS_URL, {
            method: 'GET',
            ...createAuthenticatedRequest(owner)
        });

        // Assert
        expect(getFaqs.mock.calls[0]?.[1]).toEqual({ accommodationId: ACCOMMODATION_ID });
    });
});
