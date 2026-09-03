/**
 * The venue-events gate, end to end — BLOCK side (HOS-1042).
 *
 * ---
 * WHY THIS TEST EXISTS IN THIS SHAPE
 *
 * `MANAGE_GASTRONOMY_EVENTS` is the third commerce key that is NOT in
 * `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL` — that map is the floor every tier of
 * a vertical receives, and a paid capability placed there would be handed to
 * `-basico` as well. So the default state of a commerce owner with no
 * subscription is a REFUSAL, and the block case needs no mutation to produce it.
 *
 * Neither half is sufficient alone: this one passes on a route that refuses
 * everybody, and `venue-events-entitlement-allow.e2e.test.ts` passes on a route
 * with no gate at all.
 *
 * ## The witness
 *
 * `expect(res.status).toBe(403)` is VACUOUS on its own: a request that dies
 * anywhere before the gate — a bad body, a missing header — produces one too.
 * So each case asserts BOTH that the refusal NAMES `manage_gastronomy_events`
 * (which pins the right key to the right route, and would fail if the route were
 * copy-pasted from the carta with its key left behind) and that the handler's
 * first call, strictly AFTER the gate, was or was not made.
 *
 * The key is read off `error.message` rather than `error.details`: the
 * middleware attaches both, but `details` only survives to the wire when
 * `HOSPEDA_API_DEBUG_ERRORS` is on, and this assertion must not depend on a
 * debug flag.
 *
 * ## The route that must NOT be gated
 *
 * `GET /events` is ungated on purpose: an owner whose subscription lapsed after
 * typing a season of events is still reading their own rows. The case for it
 * here is what stops a later change from "tidying up" by putting the same
 * middleware on both.
 *
 * @module test/commerce/venue-events-entitlement.e2e
 */

import { GastronomyService } from '@repo/service-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../src/app.js';
import { _resetCommerceBaseLimitCache } from '../../src/middlewares/commerce-entitlement.js';
import type { AppOpenAPI } from '../../src/types.js';

const USER_AGENT = { 'user-agent': 'vitest' };
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const LISTING_ID = '22222222-2222-4222-8222-222222222222';

const EVENTS_PATH = `/api/v1/protected/gastronomies/${LISTING_ID}/events`;

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

/** An agenda the payload schema accepts, so nothing fails before the gate. */
const VALID_EVENTS_BODY = JSON.stringify({
    events: [
        {
            title: 'Happy hour',
            recurrence: 'weekly',
            weekday: 4,
            startTime: '18:00',
            endTime: '20:00'
        }
    ]
});

describe('gastronomy venue events entitlement gate — block side (HOS-1042)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        _resetCommerceBaseLimitCache();
    });

    it('refuses PUT /events to an owner whose plan does not grant the agenda', async () => {
        // The witness: `replaceGastronomyEvents` loads the listing through the
        // model, and the route reaches it only after the gate has run.
        const witness = vi.spyOn(GastronomyService.prototype, 'getById');

        const res = await app.request(EVENTS_PATH, {
            method: 'PUT',
            headers: ownerHeaders,
            body: VALID_EVENTS_BODY
        });
        const body = (await res.json()) as { error?: { code?: string; message?: string } };

        expect(res.status).toBe(403);
        expect(body.error?.code).toBe('ENTITLEMENT_REQUIRED');
        // Pins the right KEY to the right route. A bare 403 cannot tell you
        // whether the gate is asking for this capability or the carta's.
        expect(body.error?.message).toContain('manage_gastronomy_events');
        expect(body.error?.message).not.toContain('manage_gastronomy_menu');
        expect(witness).not.toHaveBeenCalled();
    });

    it('lets the SAME owner read GET /events — the read is deliberately ungated', async () => {
        // The other half of the tier decision, and the one a later refactor is
        // most likely to break: an owner whose subscription lapsed must still
        // see the season they typed.
        const witness = vi
            .spyOn(GastronomyService.prototype, 'getById')
            .mockResolvedValue(NOT_FOUND_RESULT);

        const res = await app.request(EVENTS_PATH, { headers: ownerHeaders });
        const body = (await res.json().catch(() => ({}))) as { error?: { code?: string } };

        expect(body.error?.code).not.toBe('ENTITLEMENT_REQUIRED');
        expect(res.status).not.toBe(403);
        // The handler ran, so the request passed everything ahead of it.
        expect(witness).toHaveBeenCalled();
    });
});
