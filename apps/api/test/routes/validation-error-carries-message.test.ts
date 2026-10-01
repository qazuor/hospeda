/**
 * GUARD: a 400 validation body always carries `error.message` (HOS-425).
 *
 * ## The regression this exists for
 *
 * The rich validation body — the one the OpenAPI request validator's
 * `defaultHook` emits — listed `code`, `messageKey`, `details`, `summary` and
 * `userFriendlyMessage`, and NO `message`. R5 of `docs/error-contract.md` says
 * "the client gets the code and a message", so any caller doing
 * `err.error.message` in a generic toast rendered `undefined`.
 *
 * That was survivable while cross-field rejections came out of the handler as a
 * flat `ServiceError(VALIDATION_ERROR)` `{code, message}`. Fixing the factory
 * (HOS-425) routes them through the rich body instead, on seven routes at once
 * — measured on `POST /protected/host-trades/mine/usages`:
 *
 *   before  {"code":"VALIDATION_ERROR","message":"zodError.hostTradeUsage.hostIdentifier.exactlyOne"}
 *   after   {"code":"VALIDATION_ERROR","messageKey":"validationError.validation.failed", ...}
 *
 * Same status, same code, and `message` gone. So `message` was added to all
 * three emitters of that body. This test pins it for the two a request can
 * actually reach, because the fix is one word in an object literal and nothing
 * else would notice it being deleted again.
 *
 * @module test/routes/validation-error-carries-message
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';

const ADMIN_HEADERS = {
    'Content-Type': 'application/json',
    'user-agent': 'vitest',
    'x-mock-actor-id': ACTOR_ID,
    'x-mock-actor-role': 'ADMIN',
    'x-mock-actor-permissions': JSON.stringify([
        'access.panelAdmin',
        'event.create',
        'event.viewAll'
    ])
};

/** A create body whose `date` range is inverted — a CROSS-FIELD rejection. */
const CROSS_FIELD_VIOLATION = {
    name: 'Fiesta de la Playa',
    summary: 'Una fiesta en la costanera con musica en vivo y food trucks.',
    category: 'MUSIC',
    date: {
        start: '2030-02-01T23:00:00.000Z',
        end: '2030-02-01T18:00:00.000Z',
        precision: 'EXACT'
    }
};

/** The same route, rejected for an ordinary FIELD-level reason. */
const FIELD_LEVEL_VIOLATION = { name: 'x' };

let app: AppOpenAPI;

const postEvent = (body: unknown) =>
    app.request('/api/v1/admin/events', {
        method: 'POST',
        headers: ADMIN_HEADERS,
        body: JSON.stringify(body)
    });

beforeAll(async () => {
    app = initApp();
});

describe('a 400 validation body carries error.message (error-contract R5)', () => {
    it('on a cross-field rejection, which HOS-425 moved into this body', async () => {
        const response = await postEvent(CROSS_FIELD_VIOLATION);
        const payload = (await response.json()) as {
            error?: { message?: string; userFriendlyMessage?: string; code?: string };
        };

        expect(response.status).toBe(400);
        expect(payload.error?.code).toBe('VALIDATION_ERROR');
        // Not `toBeDefined()`: `undefined` is exactly what the bug produced, and
        // an empty string would render just as blank in a toast.
        expect(typeof payload.error?.message).toBe('string');
        expect(payload.error?.message?.length ?? 0).toBeGreaterThan(0);
    });

    it('on an ordinary field-level rejection, which always used this body', async () => {
        const response = await postEvent(FIELD_LEVEL_VIOLATION);
        const payload = (await response.json()) as { error?: { message?: string } };

        expect(response.status).toBe(400);
        expect(typeof payload.error?.message).toBe('string');
        expect(payload.error?.message?.length ?? 0).toBeGreaterThan(0);
    });

    it('keeps every key the body already had, so nothing downstream loses a field', async () => {
        const response = await postEvent(CROSS_FIELD_VIOLATION);
        const payload = (await response.json()) as { error?: Record<string, unknown> };
        const keys = Object.keys(payload.error ?? {});

        // The addition is additive by design; listing the old keys explicitly is
        // what would catch a "tidy-up" that swaps one of them for `message`.
        expect(keys).toEqual(
            expect.arrayContaining([
                'code',
                'message',
                'messageKey',
                'details',
                'summary',
                'userFriendlyMessage'
            ])
        );
    });
});
