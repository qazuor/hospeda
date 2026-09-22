/**
 * HTTP wire test for `PATCH /api/v1/admin/content-moderation/thresholds/:id`
 * (HOS-425).
 *
 * This is the route the issue nominated to look at first, on the theory that
 * its `pending < reject` invariant was backed only by a database CHECK and
 * would therefore surface as a 500 rather than a 400. That theory is WRONG, and
 * this test is where it is settled: `ContentModerationThresholdService.update`
 * overrides the base method specifically to re-check the invariant against the
 * stored row, and `BaseCrudService.update` re-parses the payload with the same
 * refined schema besides. An inverted pair has always come back as a 400.
 *
 * What the factory fix changes is WHERE the 400 comes from — the route boundary
 * instead of the service, before the id is looked up rather than after. So the
 * two assertions that matter are the status AND the fact that the service is
 * never reached.
 *
 * @module test/routes/content-moderation/threshold-patch-refinement
 */

import { ContentModerationThresholdService } from '@repo/service-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app.js';
import type { AppOpenAPI } from '../../../src/types.js';

const THRESHOLD_ID = '66666666-6666-4666-8666-666666666666';

const ADMIN_HEADERS = {
    'Content-Type': 'application/json',
    'user-agent': 'vitest',
    'x-mock-actor-id': '11111111-1111-4111-8111-111111111111',
    'x-mock-actor-role': 'ADMIN',
    // `moderation.threshold.view` rides along because the sibling GET /{id}
    // route is mounted at the same path, and a sub-app's middleware applies to
    // every method on it — so its gate also runs on this PATCH.
    'x-mock-actor-permissions': JSON.stringify([
        'access.panelAdmin',
        'moderation.threshold.update',
        'moderation.threshold.view'
    ])
};

let app: AppOpenAPI;
let updateSpy: ReturnType<typeof vi.spyOn>;

const patch = (body: unknown) =>
    app.request(`/api/v1/admin/content-moderation/thresholds/${THRESHOLD_ID}`, {
        method: 'PATCH',
        headers: ADMIN_HEADERS,
        body: JSON.stringify(body)
    });

beforeAll(async () => {
    app = initApp();
});

beforeEach(() => {
    // Stubbed so the assertion is about the ROUTE boundary: with the real
    // service in place a rejection could come from its own invariant check and
    // the test could not tell the two apart.
    updateSpy = vi.spyOn(ContentModerationThresholdService.prototype, 'update').mockResolvedValue({
        data: {
            id: THRESHOLD_ID,
            context: 'accommodation',
            pending: 0.5,
            reject: 0.9,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            deletedAt: null,
            createdById: null,
            updatedById: null
        }
    } as never);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('PATCH /admin/content-moderation/thresholds/:id — pending < reject (HOS-425)', () => {
    it('rejects an inverted pair with 400 before the service is consulted', async () => {
        const response = await patch({ pending: 0.9, reject: 0.5 });

        expect(response.status).toBe(400);
        expect(updateSpy).not.toHaveBeenCalled();
    });

    it('never answers INTERNAL_ERROR for a bad input (error contract)', async () => {
        const response = await patch({ pending: 0.9, reject: 0.5 });
        const payload = (await response.json()) as { error?: { code?: string } };

        expect(payload.error?.code).not.toBe('INTERNAL_ERROR');
    });

    it('lets an ordered pair past the boundary', async () => {
        const response = await patch({ pending: 0.5, reject: 0.9 });

        // NOT a 200: this route builds its service inside the handler, and
        // under the global `@repo/db` mock that construction throws, so the
        // request ends 500. Which is exactly what makes this assertion
        // meaningful — reaching the handler at all means the body cleared
        // validation. `refinement-enforcement.test.ts` covers the accept side
        // rigorously at the schema level; the job here is only to show the
        // route does not reject what the rule allows.
        expect(response.status).not.toBe(400);
    });

    it('leaves a single-sided patch to the service, which merges it with the stored row', async () => {
        // The schema's rule only fires when BOTH values are present, so this
        // body must still get through — the service is the only layer that can
        // read the current row and decide. A route fix that swallowed it here
        // would break the half of the invariant the schema cannot express.
        const response = await patch({ pending: 0.95 });

        expect(response.status).not.toBe(400);
    });
});
