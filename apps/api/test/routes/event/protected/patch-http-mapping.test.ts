/**
 * Wire test for `PATCH /api/v1/protected/events/:id` (H-30).
 *
 * ## What broke, and why no test caught it
 *
 * The protected event surface speaks HTTP names (`startDate`, `endDate`);
 * `EventService` speaks domain names (`date.start`, `date.end`). Exactly one
 * thing knows the translation — `httpToDomainEventUpdate` — and this route
 * skipped it, handing the raw body to `eventService.update`. Measured in
 * production: editing an event's date answered
 * `400 Unrecognized keys: "startDate","endDate"` (the domain update schema is
 * `.strict()`), and editing its name answered 500.
 *
 * Its three sibling routes all call their mapper, including
 * `event/protected/update.ts` — the PUT on the same resource. Both the mapper
 * and the service were individually well tested; what nobody tested was the
 * seam between them, and that is where the contract broke.
 *
 * So these tests assert on the ARGUMENT the service receives, not on the
 * response body. A route that answers 200 while handing the service the wrong
 * shape is the failure being guarded against, and a status assertion cannot
 * see it. `expect.objectContaining` is avoided for the same reason: it is blind
 * to a key that is missing.
 *
 * @module test/routes/event/protected/patch-http-mapping
 */

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { EventService, ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    clearEntityFetchers,
    registerEntityFetcher
} from '../../../../src/middlewares/ownership.js';
import { protectedPatchEventRoute } from '../../../../src/routes/event/protected/patch.js';
import type { AppBindings } from '../../../../src/types.js';

const EVENT_ID = '00000000-0000-4000-8000-000000000001';
const AUTHOR_ID = '11111111-1111-4111-8111-111111111111';

const HEADERS = {
    'Content-Type': 'application/json',
    // `API_VALIDATION_REQUIRED_HEADERS` defaults to user-agent; without it every
    // request short-circuits with a 400 before routing.
    'user-agent': 'vitest'
};

/**
 * Maps thrown errors to statuses the way the real app does.
 *
 * Without this a `ServiceError` escapes as an unhandled 500, which makes every
 * status assertion below read 500 whether the code is right or wrong — the
 * instrument stops discriminating. Mirrors
 * `accommodation/protected/featured-toggle.test.ts`.
 */
function attachTestErrorHandler(app: Hono<AppBindings>): void {
    const status: Partial<Record<ServiceErrorCode, 400 | 403 | 404>> = {
        [ServiceErrorCode.VALIDATION_ERROR]: 400,
        [ServiceErrorCode.FORBIDDEN]: 403,
        [ServiceErrorCode.NOT_FOUND]: 404
    };

    app.onError((error, c) => {
        if (error instanceof ServiceError) {
            return c.json(
                { success: false, error: { code: error.code, message: error.message } },
                status[error.code] ?? 500
            );
        }
        if (error instanceof HTTPException) {
            return error.getResponse();
        }
        return c.json({ success: false, error: { message: String(error) } }, 500);
    });
}

/** Mounts the route under test with the author already resolved as the actor. */
function buildApp(): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    attachTestErrorHandler(app);

    app.use((c, next) => {
        c.set('actor', {
            id: AUTHOR_ID,
            roles: [RoleEnum.USER],
            permissions: [PermissionEnum.EVENT_UPDATE_OWN]
        });
        return next();
    });

    app.route('/', protectedPatchEventRoute);

    return app;
}

/** The input `EventService.update` was called with. */
function serviceInput(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
    expect(spy).toHaveBeenCalledTimes(1);
    return (spy.mock.calls[0]?.[2] ?? {}) as Record<string, unknown>;
}

let updateSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    // The ownership middleware resolves the entity through an injectable
    // fetcher, so no database is involved. The fetcher returns a Result
    // envelope, not the entity — returning the bare entity leaves `result.data`
    // undefined and the middleware answers 404 before the handler runs.
    registerEntityFetcher('event', async () => ({
        data: { id: EVENT_ID, authorId: AUTHOR_ID }
    }));

    updateSpy = vi.spyOn(EventService.prototype, 'update').mockResolvedValue({
        data: { id: EVENT_ID, slug: 'an-existing-slug' }
    } as never);
});

afterEach(() => {
    clearEntityFetchers();
    vi.restoreAllMocks();
});

describe('PATCH /protected/events/:id — HTTP to domain mapping (H-30)', () => {
    it('hands the service a nested date object, never the HTTP date keys', async () => {
        await buildApp().request(`/${EVENT_ID}`, {
            method: 'PATCH',
            headers: HEADERS,
            body: JSON.stringify({
                startDate: '2030-02-01T10:00:00.000Z',
                endDate: '2030-02-01T18:00:00.000Z'
            })
        });

        const input = serviceInput(updateSpy);
        const date = input.date as { start?: Date; end?: Date } | undefined;

        expect(date?.start).toEqual(new Date('2030-02-01T10:00:00.000Z'));
        expect(date?.end).toEqual(new Date('2030-02-01T18:00:00.000Z'));
        // The raw HTTP names are what the strict domain schema rejected in prod.
        expect(Object.keys(input)).not.toContain('startDate');
        expect(Object.keys(input)).not.toContain('endDate');
    });

    it('forwards a rename as a domain field the service recognises', async () => {
        await buildApp().request(`/${EVENT_ID}`, {
            method: 'PATCH',
            headers: HEADERS,
            body: JSON.stringify({ name: 'A brand new event name' })
        });

        expect(serviceInput(updateSpy).name).toBe('A brand new event name');
    });

    it('derives summary from description, as the mapper defines it', async () => {
        const description = 'z'.repeat(400);

        await buildApp().request(`/${EVENT_ID}`, {
            method: 'PATCH',
            headers: HEADERS,
            body: JSON.stringify({ description })
        });

        const input = serviceInput(updateSpy);

        expect(input.description).toBe(description);
        expect(input.summary).toBe(description.slice(0, 300));
    });

    it('rejects an endDate sent without a startDate rather than dropping it', async () => {
        // The mapper only emits a `date` when `startDate` is present, because
        // the domain object requires `start`. Wiring this route to the mapper
        // therefore turned what used to be a loud 400 ("unrecognized key
        // endDate") into a silent 200 that stored nothing — a regression this
        // fix would otherwise have introduced. The pairing guard closes it.
        const response = await buildApp().request(`/${EVENT_ID}`, {
            method: 'PATCH',
            headers: HEADERS,
            body: JSON.stringify({ endDate: '2030-02-01T18:00:00.000Z' })
        });

        expect(response.status).toBe(400);
        expect(updateSpy).not.toHaveBeenCalled();
    });

    it('rejects a field no write path stores instead of answering 200 (H-134)', async () => {
        const response = await buildApp().request(`/${EVENT_ID}`, {
            method: 'PATCH',
            headers: HEADERS,
            body: JSON.stringify({ capacity: 250 })
        });

        expect(response.status).toBe(400);
        expect(updateSpy).not.toHaveBeenCalled();
    });
});
