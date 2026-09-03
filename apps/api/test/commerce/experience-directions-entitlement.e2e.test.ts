/**
 * The meeting-point directions gate, end to end — BLOCK side (HOS-1049).
 *
 * ---
 * WHY THIS TEST EXISTS IN THIS SHAPE
 *
 * `MANAGE_EXPERIENCE_DIRECTIONS` is the third commerce key that is NOT in
 * `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL` — that map is the floor every tier of
 * a vertical receives, and a paid capability placed there would be handed to
 * `experience-basico`, which today is the only sellable experience tier. So the
 * default state of a commerce owner with no subscription is a REFUSAL, and the
 * block case needs no mutation to produce it.
 *
 * Neither half is sufficient alone: this file passes on a route that refuses
 * everybody, and `experience-directions-entitlement-allow.e2e.test.ts` passes
 * on a route with no gate at all.
 *
 * ## What makes this gate different from HOS-895's
 *
 * It is a FIELD gate, not a route gate. The same PATCH carries the price, the
 * meeting point, the checklists — all free on `-basico` — so the third case
 * below is the load-bearing one: the SAME unentitled owner, on the SAME route,
 * sending a body that does NOT name `meetingPointDirections`, must be let
 * through. Without it, a "tidy-up" that promoted the check to
 * `options.middlewares` would look correct here while locking every `-basico`
 * provider out of editing their own listing.
 *
 * ## The witness
 *
 * `expect(res.status).toBe(403)` is VACUOUS on its own: a request that dies
 * anywhere before the gate — a bad body, a missing header — produces one too.
 * So each case asserts BOTH that the refusal NAMES
 * `manage_experience_directions` and whether `updateOwn`, strictly AFTER the
 * gate, was called.
 *
 * The key is read off `error.message` rather than `error.details`: the route
 * attaches both, but `details` only reaches the wire when
 * `HOSPEDA_API_DEBUG_ERRORS` is on, and this must not depend on a debug flag.
 *
 * @module test/commerce/experience-directions-entitlement.e2e
 */

import { ExperienceService } from '@repo/service-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../src/app.js';
import { _resetCommerceBaseLimitCache } from '../../src/middlewares/commerce-entitlement.js';
import type { AppOpenAPI } from '../../src/types.js';

const USER_AGENT = { 'user-agent': 'vitest' };
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const LISTING_ID = '22222222-2222-4222-8222-222222222222';

const PATCH_PATH = `/api/v1/protected/experiences/${LISTING_ID}`;

/** A commerce owner on the entry plan: no pro/premium grant anywhere. */
const ownerHeaders = {
    ...USER_AGENT,
    'content-type': 'application/json',
    'x-mock-actor-id': OWNER_ID,
    'x-mock-actor-role': 'COMMERCE_OWNER',
    'x-mock-actor-permissions': JSON.stringify(['commerce.create', 'commerce.editOwn'])
};

/** A `Result`-shaped failure, so a stubbed service call returns cleanly. */
const NOT_FOUND_RESULT = {
    data: undefined,
    error: { code: 'NOT_FOUND', message: 'listing not found' }
} as never;

/** A body that names the gated field, and nothing the schema would reject. */
const GATED_BODY = JSON.stringify({
    meetingPointDirections: ['Estacioná en la bajada municipal, sobre la costanera.']
});

/** A body of purely FREE ficha fields — must pass on the very same plan. */
const FREE_BODY = JSON.stringify({
    meetingPoint: 'Muelle 3 del puerto, frente a la caseta azul'
});

describe('experience directions entitlement gate — block side (HOS-1049)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        _resetCommerceBaseLimitCache();
    });

    it('refuses a PATCH that sets meetingPointDirections without the plan for it', async () => {
        // The witness: `updateOwn` is the first thing the handler calls, and
        // strictly after the gate.
        const witness = vi.spyOn(ExperienceService.prototype, 'updateOwn');

        const res = await app.request(PATCH_PATH, {
            method: 'PATCH',
            headers: ownerHeaders,
            body: GATED_BODY
        });
        const body = (await res.json()) as { error?: { code?: string; message?: string } };

        expect(res.status).toBe(403);
        expect(body.error?.code).toBe('ENTITLEMENT_REQUIRED');
        // Pins the right KEY to the right route. A bare 403 cannot tell you
        // whether the gate is asking for this capability or `EDIT_EXPERIENCE_INFO`.
        expect(body.error?.message).toContain('manage_experience_directions');
        expect(witness).not.toHaveBeenCalled();
    });

    it('lets the SAME owner PATCH the free ficha fields — the gate is per FIELD', async () => {
        // The half a later refactor is most likely to break. Promoting the
        // check to `options.middlewares` would pass every assertion in the case
        // above and fail this one, which is exactly the point.
        const witness = vi
            .spyOn(ExperienceService.prototype, 'updateOwn')
            .mockResolvedValue(NOT_FOUND_RESULT);

        const res = await app.request(PATCH_PATH, {
            method: 'PATCH',
            headers: ownerHeaders,
            body: FREE_BODY
        });
        const body = (await res.json().catch(() => ({}))) as { error?: { code?: string } };

        expect(body.error?.code).not.toBe('ENTITLEMENT_REQUIRED');
        // The handler ran, so the request passed everything ahead of it.
        expect(witness).toHaveBeenCalled();
    });

    it('refuses an EMPTY directions list too — clearing is a write like any other', async () => {
        // `[]` is a legitimate submission meaning "delete them", and it is the
        // shape an `if (body.meetingPointDirections?.length)` gate would wave
        // through. The check asks whether the KEY is present, not whether it
        // carries anything.
        const witness = vi.spyOn(ExperienceService.prototype, 'updateOwn');

        const res = await app.request(PATCH_PATH, {
            method: 'PATCH',
            headers: ownerHeaders,
            body: JSON.stringify({ meetingPointDirections: [] })
        });
        const body = (await res.json()) as { error?: { code?: string; message?: string } };

        expect(res.status).toBe(403);
        expect(body.error?.message).toContain('manage_experience_directions');
        expect(witness).not.toHaveBeenCalled();
    });
});
