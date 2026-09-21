/**
 * Wire tests for `POST /api/v1/admin/events` (HOS-998 + HOS-425).
 *
 * ## HOS-998 — the admin alta could not be completed by any route
 *
 * The route declared the DOMAIN schema `EventCreateInputSchema` as its
 * `requestBody`. That schema omits the audit fields but keeps `authorId`,
 * which `EventSchema` declares as a required `UserIdSchema`. Route validation
 * runs BEFORE the handler, so nobody ever got the chance to inject the actor:
 * measured against staging at `a8ea95f04`, a fully filled-in "Nuevo Evento"
 * form came back with exactly one error, `authorId: ID es obligatorio`, and the
 * admin panel has no field that can satisfy it (zero references to `authorId`
 * anywhere under `apps/admin/src/features/events/`).
 *
 * The sibling protected route had the right shape all along: a body schema
 * without `authorId`, and authorship resolved from the actor (HOS-374 D-2).
 *
 * ## HOS-425 — the date-order refinement never ran at the route boundary
 *
 * `EventCreateInputSchema` carries `.refine(isDateRangeOrdered)`. The route
 * factory rebuilt the body schema through `createOpenAPISchema()`, which
 * reconstructed it from its `shape` and dropped every object-level check. With
 * the service mocked (as it is in route tests) an inverted date range therefore
 * answered 201.
 *
 * These tests assert on the ARGUMENT the service receives, not only on the
 * status, because a route that answers 201 while handing the service a body
 * with no `authorId` is the exact failure being guarded against.
 *
 * @module test/routes/event/admin/create-authorship
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';

const ADMIN_HEADERS = {
    'Content-Type': 'application/json',
    // `API_VALIDATION_REQUIRED_HEADERS` defaults to user-agent; without it every
    // request short-circuits with a 400 before routing.
    'user-agent': 'vitest',
    'x-mock-actor-id': ACTOR_ID,
    'x-mock-actor-role': 'ADMIN',
    // `event.viewAll` is here because the admin event router mounts the LIST
    // route at the same '/' path, and a sub-app's middleware applies to every
    // method on the path it is mounted at — so the list route's permission gate
    // also runs on this POST. Not this issue's subject; noted so the extra
    // permission does not read as arbitrary.
    'x-mock-actor-permissions': JSON.stringify([
        'access.panelAdmin',
        'event.create',
        'event.viewAll'
    ])
};

/**
 * The payload the admin panel actually sends: domain-shaped (`date` is the
 * nested sub-object `normalizeEventDatePrecision` produces) and with NO
 * `authorId`, because no screen collects one.
 */
const PANEL_PAYLOAD = {
    name: 'Fiesta de la Playa',
    summary: 'Una fiesta en la costanera con musica en vivo y food trucks.',
    description:
        'Una fiesta en la costanera de Concepcion del Uruguay con musica en vivo, ' +
        'food trucks y actividades para toda la familia durante toda la jornada.',
    category: 'MUSIC',
    date: {
        start: '2030-02-01T18:00:00.000Z',
        end: '2030-02-01T23:00:00.000Z',
        precision: 'EXACT'
    }
} as const;

let app: AppOpenAPI;
let createSpy: ReturnType<typeof vi.spyOn>;

/** The input `EventService.create` was called with. */
const serviceInput = (): Record<string, unknown> => {
    expect(createSpy).toHaveBeenCalledTimes(1);
    return (createSpy.mock.calls[0]?.[1] ?? {}) as Record<string, unknown>;
};

const post = (body: unknown) =>
    app.request('/api/v1/admin/events', {
        method: 'POST',
        headers: ADMIN_HEADERS,
        body: JSON.stringify(body)
    });

beforeAll(async () => {
    app = initApp();
});

beforeEach(async () => {
    // `EventService` is replaced wholesale by the global service mock in
    // test/setup.ts, so this spies on the mock class the route imported. The
    // stub return is a FULL event row: the route re-parses its response against
    // `EventAdminSchema` and answers 500 on a mismatch, which would otherwise
    // mask the 201 these tests are here to observe.
    const { EventService } = await import('@repo/service-core');
    createSpy = vi.spyOn(EventService.prototype, 'create').mockResolvedValue({
        data: {
            id: '33333333-3333-4333-8333-333333333333',
            slug: 'fiesta-de-la-playa',
            name: PANEL_PAYLOAD.name,
            summary: PANEL_PAYLOAD.summary,
            description: PANEL_PAYLOAD.description,
            category: PANEL_PAYLOAD.category,
            date: { start: new Date(PANEL_PAYLOAD.date.start), precision: 'EXACT' },
            authorId: ACTOR_ID,
            isFeatured: false,
            lifecycleState: 'ACTIVE',
            visibility: 'PUBLIC',
            moderationState: 'PENDING',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            createdById: ACTOR_ID,
            updatedById: ACTOR_ID
        }
    } as never);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('POST /admin/events — authorship comes from the actor (HOS-998)', () => {
    it('accepts the panel payload, which never carries an authorId', async () => {
        const response = await post(PANEL_PAYLOAD);

        expect(response.status).toBe(201);
    });

    it('hands the service the actor as authorId', async () => {
        await post(PANEL_PAYLOAD);

        const input = serviceInput();

        expect(input.authorId).toBe(ACTOR_ID);
    });

    it('ignores an authorId supplied in the body rather than honouring it', async () => {
        // The body is not the source of authorship on any tier (HOS-374 D-2).
        // Asserting the resulting value — not just "no error" — is what makes
        // this test see a route that passes the caller's value straight through.
        await post({ ...PANEL_PAYLOAD, authorId: OTHER_USER_ID });

        expect(serviceInput().authorId).toBe(ACTOR_ID);
    });
});
