/**
 * Regression tests for the API error contract as enforced by `ownershipMiddleware`.
 *
 * Two defects from the August 2026 production smoke live in this one file
 * because they live in this one middleware:
 *
 * - **H-68** — the middleware read `c.req.param()` raw and handed it straight to
 *   the entity fetcher, so `GET /protected/events/abc` reached Postgres, failed
 *   the `uuid` cast, and surfaced as `500 INTERNAL_ERROR` on 19 protected
 *   routes. The `requestParams: { id: EventIdSchema }` the routes already
 *   declare never ran, because the factory installs ownership as a middleware —
 *   i.e. ahead of the route's own validation. The realistic trigger is not
 *   someone typing `abc`: it is a client building a URL from an empty variable
 *   and requesting `/protected/events/undefined`.
 *
 * - **H-72** — a post or event owned by somebody else answered `403` while a
 *   nonexistent one answered `404`, so the pair of statuses told any caller
 *   which ids exist. `accommodation/protected/getById.ts` already answers `404`
 *   for both, and HOS-376 fixed the convention in writing ("todo camino ajeno
 *   responde 404, nunca 403 — un 403 confirmaría que el id existe"). Three
 *   sibling entities, two conventions, same app.
 *
 * The contract these assert, in evaluation order:
 *   auth → route permission → input shape (400) → existence/ownership (404).
 * No step may touch the database with a value an earlier step did not validate.
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
    clearEntityFetchers,
    ownershipMiddleware,
    registerEntityFetcher
} from '../../src/middlewares/ownership';

vi.mock('../../src/utils/actor');
vi.mock('../../src/utils/logger');

import { getActorFromContext } from '../../src/utils/actor';
import { apiLogger } from '../../src/utils/logger';

const mockGetActorFromContext = vi.mocked(getActorFromContext);
const mockApiLogger = vi.mocked(apiLogger);

/** A well-formed id that exists and belongs to somebody else. */
const FOREIGN_ID = '11111111-1111-4111-8111-111111111111';
/** A well-formed id that matches no row. */
const MISSING_ID = '22222222-2222-4222-8222-222222222222';
/** A well-formed id owned by the acting user. */
const OWNED_ID = '33333333-3333-4333-8333-333333333333';

const ACTOR_ID = '44444444-4444-4444-8444-444444444444';

const createActor = (id = ACTOR_ID): Actor => ({
    id,
    roles: [RoleEnum.USER],
    permissions: [PermissionEnum.ACCESS_API_PUBLIC]
});

const createTestApp = (): Hono => {
    const app = new Hono();
    app.onError((err, c) => {
        if (err instanceof HTTPException) {
            return c.json({ message: err.message }, err.status);
        }
        return c.json({ message: 'Internal server error' }, 500);
    });
    return app;
};

describe('ownershipMiddleware — API error contract', () => {
    let app: Hono;

    beforeEach(() => {
        app = createTestApp();
        vi.clearAllMocks();
        clearEntityFetchers();
        mockApiLogger.debug = vi.fn();
        mockApiLogger.warn = vi.fn();
        mockApiLogger.error = vi.fn();
        mockGetActorFromContext.mockReturnValue(createActor());
    });

    /**
     * Mounts the middleware and returns the fetcher spy, so a test can assert
     * not just the status but whether the database was reached at all.
     */
    const mount = (options?: { idSchema?: z.ZodTypeAny }) => {
        const fetcher = vi.fn(async (_actor: Actor, entityId: string) => {
            if (entityId === OWNED_ID) {
                return { data: { id: OWNED_ID, ownerId: ACTOR_ID, createdById: ACTOR_ID } };
            }
            if (entityId === FOREIGN_ID) {
                return {
                    data: {
                        id: FOREIGN_ID,
                        ownerId: 'someone-else',
                        createdById: 'someone-else'
                    }
                };
            }
            return { data: null };
        });
        registerEntityFetcher('event', fetcher);

        app.use(
            '/:id',
            ownershipMiddleware({
                entityType: 'event',
                ownershipFields: ['ownerId', 'createdById'],
                ...(options?.idSchema ? { idSchema: options.idSchema } : {})
            })
        );
        app.get('/:id', (c) => c.json({ success: true }));

        return fetcher;
    };

    describe('H-68 — a malformed id is a 400, and never reaches the database', () => {
        it.each([
            ['a bare word', 'abc'],
            ['the literal "undefined" a client builds from an empty variable', 'undefined'],
            ['the literal "null"', 'null'],
            ['a numeric id', '12345'],
            ['a UUID missing a block', '11111111-1111-4111-8111'],
            ['an empty-ish segment', '%20']
        ])('%s answers 400, not 500', async (_label, badId) => {
            const fetcher = mount();

            const res = await app.request(`/${badId}`);

            expect(res.status).toBe(400);
            // The load-bearing half: a 400 produced AFTER querying Postgres
            // would still be a 400, so the status alone cannot tell the fix
            // from a coincidence. The database must not be reached at all.
            expect(fetcher).not.toHaveBeenCalled();
        });

        it('does not leak the offending value or any SQL in the response body', async () => {
            mount();

            const res = await app.request('/abc');
            const body = (await res.json()) as { message: string };

            expect(body.message).not.toMatch(/select|from|join|abc/i);
        });

        it('honours the id schema the route declares instead of assuming UUID', async () => {
            const fetcher = mount({ idSchema: z.string().regex(/^evt_[0-9]+$/) });

            expect((await app.request('/evt_42')).status).toBe(404); // shape ok, row missing
            expect(fetcher).toHaveBeenCalledWith(expect.anything(), 'evt_42');

            fetcher.mockClear();
            expect((await app.request('/abc')).status).toBe(400);
            expect(fetcher).not.toHaveBeenCalled();
        });

        it('still answers 500 when the fetcher fails for a real reason', async () => {
            registerEntityFetcher(
                'event',
                vi.fn().mockRejectedValue(new Error('connection terminated unexpectedly'))
            );
            app.use(
                '/:id',
                ownershipMiddleware({ entityType: 'event', ownershipFields: ['ownerId'] })
            );
            app.get('/:id', (c) => c.json({ success: true }));

            const res = await app.request(`/${OWNED_ID}`);

            expect(res.status).toBe(500);
        });
    });

    describe('H-72 — a foreign resource is indistinguishable from a missing one', () => {
        it('answers 404 for a resource owned by somebody else', async () => {
            mount();

            const res = await app.request(`/${FOREIGN_ID}`);

            expect(res.status).toBe(404);
        });

        it('answers 404 for a resource that does not exist', async () => {
            mount();

            const res = await app.request(`/${MISSING_ID}`);

            expect(res.status).toBe(404);
        });

        it('returns byte-identical responses for the foreign and the missing id', async () => {
            mount();

            const foreign = await app.request(`/${FOREIGN_ID}`);
            const missing = await app.request(`/${MISSING_ID}`);

            // Status parity alone is not enough: a differing message would
            // still tell the caller which id exists, which is the whole finding.
            expect(foreign.status).toBe(missing.status);
            expect(await foreign.text()).toBe(await missing.text());
        });

        it('still lets the owner through', async () => {
            mount();

            expect((await app.request(`/${OWNED_ID}`)).status).toBe(200);
        });

        it('keeps the two cases distinguishable in the SERVER log', async () => {
            mount();

            await app.request(`/${FOREIGN_ID}`);

            // The mitigation that makes 404 acceptable: support keeps the
            // signal, the client loses it.
            expect(mockApiLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Ownership denied')
            );
        });
    });
});
