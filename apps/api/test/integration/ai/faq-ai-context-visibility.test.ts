/**
 * Regression test for HOS-670 — "the listing assistant never sees the host's
 * AI-usable FAQs" (smoke finding F-59, 2026-08-18/19).
 *
 * Every other test that touches {@link assembleAccommodationContext} /
 * {@link buildMarkdownContext} (`apps/api/test/services/accommodation-ai-context.test.ts`)
 * mocks `@repo/service-core` and `@repo/db` entirely (see that file's
 * `vi.mock('@repo/service-core', ...)` / `vi.mock('@repo/db', ...)`), so none
 * of them can catch a defect in the REAL chain:
 *
 *   route actor (tourist) -> AccommodationService.getFaqs() -> AccommodationModel
 *   .findWithRelations() -> Drizzle `faqs` relation -> buildMarkdownContext's
 *   isUsableByAi filter -> the "### FAQs" section of the prompt.
 *
 * This file exercises that chain against a REAL Postgres database (via the
 * `test:integration` ephemeral-DB setup — see `vitest.config.integration.ts`
 * and `test/integration/global-setup.ts`), with a plain tourist (RoleEnum.USER)
 * actor — the same actor shape the `/api/v1/protected/ai/chat` route resolves
 * for a guest browsing the listing.
 *
 * @module test/integration/ai/faq-ai-context-visibility
 */

import { accommodationFaqs, accommodations, destinations, getDb, users } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assembleAccommodationContext } from '../../../src/services/accommodation-ai-context.js';
import { testDb } from '../../e2e/setup/test-database';

const OWNER_ID = crypto.randomUUID();
const DESTINATION_ID = crypto.randomUUID();
const ACCOMMODATION_ID = crypto.randomUUID();
const TOURIST_ID = crypto.randomUUID();

const AI_USABLE_QUESTION = '¿La pileta está climatizada?';
const AI_USABLE_ANSWER = 'La pileta es exterior y no está climatizada.';
const NOT_AI_USABLE_QUESTION = '¿Cuáles son las condiciones exactas de cancelación?';
const NOT_AI_USABLE_ANSWER = 'Texto legal exacto que nunca debe llegar al modelo.';

/** Plain tourist actor — mirrors what `actorMiddleware()` resolves for a logged-in guest. */
const touristActor: Actor = {
    id: TOURIST_ID,
    roles: [RoleEnum.USER],
    permissions: []
};

/**
 * Seeds an owner, a destination, a PUBLIC/ACTIVE accommodation, and two FAQs:
 * one AI-usable (the "pileta" FAQ the smoke expected the assistant to use)
 * and one explicitly NOT AI-usable (the complement — must never reach the
 * model regardless of how the first case is fixed).
 */
async function seedAccommodationWithFaqs(): Promise<void> {
    const db = getDb();

    await db.insert(users).values({
        id: OWNER_ID,
        email: `hos-670-owner-${OWNER_ID}@example.com`,
        displayName: 'HOS-670 Owner',
        emailVerified: true,
        lifecycleState: 'ACTIVE'
    } as typeof users.$inferInsert);

    await db.insert(destinations).values({
        id: DESTINATION_ID,
        slug: `hos-670-destination-${DESTINATION_ID}`,
        name: 'HOS-670 Destination',
        destinationType: 'CITY',
        level: 4,
        path: `/hos-670/dest-${DESTINATION_ID}`,
        summary: 'HOS-670 destination summary',
        description: 'HOS-670 destination description',
        location: {
            state: 'Entre Rios',
            country: 'Argentina',
            coordinates: { lat: '-32.48', long: '-58.23' }
        },
        media: {
            featuredImage: {
                moderationState: 'APPROVED',
                url: 'https://example.com/hos-670-destination.jpg'
            }
        },
        lifecycleState: 'ACTIVE'
    } as typeof destinations.$inferInsert);

    await db.insert(accommodations).values({
        id: ACCOMMODATION_ID,
        slug: `hos-670-accommodation-${ACCOMMODATION_ID}`,
        name: 'Hermosa Casa Quinta',
        summary: 'HOS-670 accommodation summary',
        description: 'HOS-670 accommodation description',
        type: 'HOUSE',
        ownerId: OWNER_ID,
        destinationId: DESTINATION_ID,
        location: {
            state: 'Entre Rios',
            country: 'Argentina',
            coordinates: { lat: '-32.48', long: '-58.23' }
        },
        media: {
            featuredImage: {
                moderationState: 'APPROVED',
                url: 'https://example.com/hos-670-accommodation.jpg'
            }
        },
        lifecycleState: 'ACTIVE',
        visibility: 'PUBLIC',
        ownerSuspended: false
    } as typeof accommodations.$inferInsert);

    await db.insert(accommodationFaqs).values([
        {
            id: crypto.randomUUID(),
            accommodationId: ACCOMMODATION_ID,
            question: AI_USABLE_QUESTION,
            answer: AI_USABLE_ANSWER,
            isVisibleOnListing: true,
            isUsableByAi: true,
            displayOrder: 0
        },
        {
            id: crypto.randomUUID(),
            accommodationId: ACCOMMODATION_ID,
            question: NOT_AI_USABLE_QUESTION,
            answer: NOT_AI_USABLE_ANSWER,
            isVisibleOnListing: true,
            isUsableByAi: false,
            displayOrder: 1
        }
    ] as (typeof accommodationFaqs.$inferInsert)[]);
}

describe('HOS-670 — AI chat context includes the host AI-usable FAQs', () => {
    beforeAll(async () => {
        await testDb.setup();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    afterEach(async () => {
        await testDb.clean();
    });

    beforeEach(async () => {
        await seedAccommodationWithFaqs();
    });

    it('includes an AI-usable FAQ in the tourist-facing context block (regression for F-59)', async () => {
        const { contextBlock } = await assembleAccommodationContext({
            actor: touristActor,
            accommodationId: ACCOMMODATION_ID,
            resolvedPrompt: 'You are a helpful assistant.',
            locale: 'es'
        });

        expect(contextBlock).toContain('### FAQs');
        expect(contextBlock).toContain(AI_USABLE_QUESTION);
        expect(contextBlock).toContain(AI_USABLE_ANSWER);
    });

    it('never includes a FAQ marked isUsableByAi=false, even for the same accommodation (complement — no over-widening)', async () => {
        const { contextBlock } = await assembleAccommodationContext({
            actor: touristActor,
            accommodationId: ACCOMMODATION_ID,
            resolvedPrompt: 'You are a helpful assistant.',
            locale: 'es'
        });

        expect(contextBlock).not.toContain(NOT_AI_USABLE_QUESTION);
        expect(contextBlock).not.toContain(NOT_AI_USABLE_ANSWER);
    });
});
