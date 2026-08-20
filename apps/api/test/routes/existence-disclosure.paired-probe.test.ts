/**
 * HOS-600 — paired probe: "exists but is not yours" must be indistinguishable
 * from "does not exist".
 *
 * The finding this file pins was invisible to every audit that compared status
 * codes. On `/protected/users/:id` the two answers differed by status (403 vs
 * 404) and the 403 even named the permission the caller was missing. On
 * `/protected/accommodations/:id` — and, it turned out, on the experience and
 * gastronomy twins — BOTH answers were `404 NOT_FOUND`, and the entire
 * disclosure lived in one capital letter: the route hand-wrote
 * `'Accommodation not found'` for the foreign row while the service composed
 * `'accommodation not found'` for the missing one.
 *
 * So the assertion here is whole-body equality between the two probes, never
 * `expect.objectContaining` and never a status-only check. `objectContaining`
 * is blind to a field one side is missing, and a status-only check is blind to
 * the exact byte that leaked. Each pair also asserts the shared answer really
 * is `404 NOT_FOUND`, so a regression that broke BOTH probes into an identical
 * 500 could not pass by being uniformly wrong.
 *
 * WHY THIS FILE UN-MOCKS `@repo/service-core`: `test/setup.ts` replaces the
 * whole package globally, including `ServiceError` itself, with hand-written
 * fakes. Under that mock the real formatter's `error instanceof ServiceError`
 * check fails, every route error becomes a 500, and the service classes carry
 * no `ENTITY_NAME` — so a paired probe would compare two artefacts of the mock
 * and could pass with the bug fully in place. The file-local `vi.mock` below
 * restores the real module; `@repo/db` stays mocked (setup.ts), which is fine
 * because both probes are answered before anything touches it.
 *
 * Runs under the DEFAULT `apps/api` vitest config (`vitest.config.ts`, which
 * includes `test/**` and excludes only e2e/integration) — the suite CI runs.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Must come before any import of the package. Restores the real service-core
// for this file only.
vi.mock(
    '@repo/service-core',
    async (importOriginal) => await importOriginal<Record<string, unknown>>()
);

import { type PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import {
    AccommodationService,
    ExperienceService,
    GastronomyService,
    UserService
} from '@repo/service-core';
import { Hono } from 'hono';
import type { AppBindings } from '../../src/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** The caller: an ordinary signed-in account, no staff permission of any kind. */
const CALLER_ID = '11111111-1111-4111-8111-111111111111';
/** A row that really exists and belongs to somebody else. */
const FOREIGN_ID = '22222222-2222-4222-8222-222222222222';
/** A well-formed id that matches nothing. */
const INVENTED_ID = '33333333-3333-4333-8333-333333333333';
/** The other person. Never the caller. */
const OTHER_OWNER_ID = '44444444-4444-4444-8444-444444444444';

const callerActor = {
    id: CALLER_ID,
    roles: [RoleEnum.USER] as readonly RoleEnum[],
    permissions: [] as PermissionEnum[]
};

// ---------------------------------------------------------------------------
// Test app
// ---------------------------------------------------------------------------

/**
 * Mounts one route with the caller injected. No error handler is attached on
 * purpose: `createProtectedRoute` catches inside the factory and formats
 * through the REAL `handleRouteError`, so what these probes compare is the body
 * production actually sends.
 */
function buildApp(
    route: ReturnType<typeof import('../../src/utils/create-app.js').createRouter>
): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.use((c, next) => {
        c.set('actor', callerActor);
        return next();
    });
    app.route('/', route);
    return app;
}

type Probe = { readonly status: number; readonly body: unknown };

/**
 * Issues one GET and captures the complete answer. `metadata` is replaced by
 * its key list rather than dropped: its `timestamp`/`requestId` vary per
 * request by design, but a probe that grew or lost a metadata field would still
 * be caught.
 */
async function probe(app: Hono<AppBindings>, id: string): Promise<Probe> {
    const res = await app.request(`/${id}`);
    const text = await res.text();
    let body: unknown;
    try {
        body = JSON.parse(text);
    } catch {
        return { status: res.status, body: text };
    }
    if (body && typeof body === 'object' && 'metadata' in body) {
        const { metadata, ...rest } = body as Record<string, unknown>;
        body = { ...rest, metadataKeys: Object.keys(metadata as object).sort() };
    }
    return { status: res.status, body };
}

/**
 * Asserts the two answers are the same object AND that the shared answer is the
 * 404 the contract prescribes.
 */
function expectIndistinguishable(foreign: Probe, invented: Probe): void {
    // Whole-object equality. NOT objectContaining: a field present on one side
    // and missing on the other is exactly the kind of difference this must see.
    expect(foreign).toEqual(invented);

    expect(foreign.status).toBe(404);
    const error = (foreign.body as { error?: { code?: string; message?: string } }).error;
    expect(error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    // R5 / anti-enumeration: the answer names neither the missing permission
    // nor the id that was asked about.
    expect(error?.message).toEqual(expect.any(String));
    expect(error?.message).not.toMatch(/permission|USER_READ_ALL|COMMERCE_VIEW_ALL/i);
    expect(error?.message).not.toContain(FOREIGN_ID);
    expect(error?.message).not.toContain(INVENTED_ID);
}

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// GET /protected/users/:id
// ---------------------------------------------------------------------------

describe('GET /protected/users/:id — foreign account vs invented id', () => {
    beforeEach(() => {
        // Only the invented probe is expected to reach the service at all: the
        // route refuses a foreign id BEFORE the row is read. The stub covers
        // both so a regression that starts fetching again still yields a
        // comparable answer rather than a crash.
        vi.spyOn(UserService.prototype, 'getById').mockImplementation(async (_actor, id) => {
            if (id === FOREIGN_ID) {
                // A real account — this is what made the old 403 possible, and
                // it answered 403 for soft-deleted accounts too.
                return { data: { id: FOREIGN_ID } as never };
            }
            return {
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'user not found' }
            };
        });
    });

    it('answers identically to both', async () => {
        const { protectedGetUserByIdRoute } = await import(
            '../../src/routes/user/protected/getById.js'
        );
        const app = buildApp(protectedGetUserByIdRoute);

        const foreign = await probe(app, FOREIGN_ID);
        const invented = await probe(app, INVENTED_ID);

        expectIndistinguishable(foreign, invented);
    });

    it('does not read the row at all for a foreign id', async () => {
        // The timing half of the oracle: an id that is never looked up cannot
        // be told apart by how long the answer took, and a soft-deleted account
        // cannot be told from a live one either.
        const spy = vi.spyOn(UserService.prototype, 'getById');
        const { protectedGetUserByIdRoute } = await import(
            '../../src/routes/user/protected/getById.js'
        );
        const app = buildApp(protectedGetUserByIdRoute);

        await probe(app, FOREIGN_ID);

        expect(spy).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// The three owner-scoped listing routes
// ---------------------------------------------------------------------------

const OWNED_ENTITY_CASES = [
    {
        label: 'accommodations',
        service: AccommodationService,
        importRoute: async () => {
            const mod = await import('../../src/routes/accommodation/protected/getById.js');
            return mod.protectedGetOwnAccommodationByIdRoute;
        }
    },
    {
        label: 'experiences',
        service: ExperienceService,
        importRoute: async () => {
            const mod = await import('../../src/routes/experience/protected/getById.js');
            return mod.protectedGetExperienceByIdRoute;
        }
    },
    {
        label: 'gastronomy',
        service: GastronomyService,
        importRoute: async () => {
            const mod = await import('../../src/routes/gastronomy/protected/getById.js');
            return mod.protectedGetGastronomyByIdRoute;
        }
    }
] as const;

describe.each(OWNED_ENTITY_CASES)('GET /protected/$label/:id — foreign listing vs invented id', ({
    service,
    importRoute
}) => {
    beforeEach(() => {
        // The missing-row message is the SERVICE's own, composed from its
        // real ENTITY_NAME — not a string this test invents. Hard-coding it
        // here would let the route and the service drift apart while the
        // test stayed green.
        const missingRowMessage = `${service.ENTITY_NAME} not found`;

        vi.spyOn(service.prototype, 'getById').mockImplementation(async (_actor, id) => {
            if (id === FOREIGN_ID) {
                // A real listing owned by somebody else: the service's view
                // gate lets a published listing through, so the ROUTE is
                // what must refuse — without disclosing.
                return { data: { id: FOREIGN_ID, ownerId: OTHER_OWNER_ID } as never };
            }
            return {
                error: { code: ServiceErrorCode.NOT_FOUND, message: missingRowMessage }
            };
        });
    });

    it('answers identically to both', async () => {
        const app = buildApp(await importRoute());

        const foreign = await probe(app, FOREIGN_ID);
        const invented = await probe(app, INVENTED_ID);

        expectIndistinguishable(foreign, invented);
    });
});
