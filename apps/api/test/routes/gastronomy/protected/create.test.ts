/**
 * Unit tests for the owner self-service gastronomy create handler (HOS-166 §7.2, D-3):
 * `handleCreateGastronomyListing` behind `POST /api/v1/protected/gastronomies/`.
 *
 * The handler is exported standalone and exercised against a mocked `Context`,
 * with `GastronomyService` replaced by a spy so the exact payload passed to
 * `createForOwner()` can be inspected without a live DB.
 *
 * Covers (AC-19, D-3): `ownerId` is always `actor.id`; `visibility` is always
 * PRIVATE and `lifecycleState` always DRAFT; owner-create schema strips
 * server-owned fields; the owner path goes through `createForOwner`; service
 * errors surface as `ServiceError` with the same code.
 *
 * @module test/routes/gastronomy/protected/create
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ──────────────────────────────────────────────────────────────────────────
// Module mocks (declared BEFORE the import of the route under test).
// ──────────────────────────────────────────────────────────────────────────

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({
        use: vi.fn(),
        route: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }))
}));

vi.mock('../../../../src/utils/route-factory', () => ({
    createProtectedRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));

vi.mock('@repo/db', () => ({
    // Required by role-permissions-cache.ts, pulled in transitively via the
    // actor middleware chain at module load (same fix as start-subscription.test.ts).
    RRolePermissionModel: class MockRRolePermissionModel {
        async findAll(_filters: unknown, _opts?: unknown) {
            return { items: [], total: 0 };
        }
    },
    RUserPermissionModel: class MockRUserPermissionModel {
        async findAll(_filters: unknown, _opts?: unknown) {
            return { items: [], total: 0 };
        }
    }
}));

const { mockCreateForOwner, mockPlainCreate } = vi.hoisted(() => ({
    mockCreateForOwner: vi.fn(),
    mockPlainCreate: vi.fn()
}));
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        GastronomyService: class MockGastronomyService {
            // HOS-687: the owner path MUST go through `createForOwner` (which
            // grants the vertical owner role in the create transaction). The plain
            // `create` is kept as a spy so a regression back to it fails loudly.
            createForOwner = mockCreateForOwner;
            create = mockPlainCreate;
        }
    };
});

vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: (ctx: { get: (key: string) => unknown }) => ctx.get('actor')
}));

import {
    GastronomyOwnerCreateInputSchema,
    GastronomyTypeEnum,
    LifecycleStatusEnum,
    VisibilityEnum
} from '@repo/schemas';
import { handleCreateGastronomyListing } from '../../../../src/routes/gastronomy/protected/create';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '99999999-9999-4999-8999-999999999999';

function createMockContext() {
    const actor = {
        id: OWNER_ID,
        email: 'owner@example.com',
        name: 'Owner',
        roles: ['USER'],
        permissions: []
    };
    const store = new Map<string, unknown>([['actor', actor]]);
    return { get: vi.fn((key: string) => store.get(key)) };
}

// H-88: `destinationId` belongs in a valid body. `gastronomies.destination_id`
// is NOT NULL with no default, so a create without it never produced a row — it
// reached Postgres and came back as a bare 500. It is now rejected at the schema
// boundary instead, which is what these fixtures have to reflect. (`ownerId` is
// NOT supplied on purpose: this route forces it to `actor.id` — that is the
// behaviour several of the tests below exist to pin.)
const VALID_GASTRONOMY_BODY = {
    name: 'La Parrilla del Puerto',
    summary: 'A riverside parrilla with fresh grilled fish and steak.',
    description:
        'La Parrilla del Puerto has served the waterfront for over a decade, specializing in grilled fish.',
    type: GastronomyTypeEnum.PARRILLA,
    destinationId: '00000000-0000-4000-a000-000000000002'
};

describe('handleCreateGastronomyListing (HOS-166 §7.2, D-3)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCreateForOwner.mockResolvedValue({
            data: { id: 'listing-1', ...VALID_GASTRONOMY_BODY }
        });
    });

    it('forces ownerId = actor.id even when the body supplies a different one', async () => {
        const ctx = createMockContext();

        await handleCreateGastronomyListing(ctx as never, {
            ...VALID_GASTRONOMY_BODY,
            ownerId: OTHER_USER_ID
        });

        expect(mockCreateForOwner).toHaveBeenCalledTimes(1);
        const [, createInput] = mockCreateForOwner.mock.calls[0] as [
            unknown,
            Record<string, unknown>
        ];
        expect(createInput.ownerId).toBe(OWNER_ID);
    });

    it('forces visibility=PRIVATE and lifecycleState=DRAFT even when the body supplies other values', async () => {
        const ctx = createMockContext();

        await handleCreateGastronomyListing(ctx as never, {
            ...VALID_GASTRONOMY_BODY,
            visibility: 'PUBLIC',
            lifecycleState: 'ACTIVE'
        });

        const [, createInput] = mockCreateForOwner.mock.calls[0] as [
            unknown,
            Record<string, unknown>
        ];
        expect(createInput.visibility).toBe(VisibilityEnum.PRIVATE);
        expect(createInput.lifecycleState).toBe(LifecycleStatusEnum.DRAFT);
    });

    it('drops a caller-supplied slug end-to-end through the real request pipeline (OQ-3)', async () => {
        // The handler alone does NOT strip `slug` (it re-parses against the
        // ADMIN schema, which permits it) — the guarantee lives at the ROUTE
        // level, where `requestBody: GastronomyOwnerCreateInputSchema` runs
        // BEFORE the handler ever sees the body. Simulate that real pipeline
        // here instead of asserting a property the handler itself does not
        // own (see gastronomy.crud.schema.test.ts for the schema-level guard).
        const validatedBody = GastronomyOwnerCreateInputSchema.parse({
            ...VALID_GASTRONOMY_BODY,
            slug: 'owner-chosen-slug'
        });
        const ctx = createMockContext();

        await handleCreateGastronomyListing(ctx as never, validatedBody);

        const [, createInput] = mockCreateForOwner.mock.calls[0] as [
            unknown,
            Record<string, unknown>
        ];
        expect(createInput.slug).toBeUndefined();
    });

    it('forwards identity fields (name/description/type) to create()', async () => {
        const ctx = createMockContext();

        await handleCreateGastronomyListing(ctx as never, VALID_GASTRONOMY_BODY);

        const [actorArg, createInput] = mockCreateForOwner.mock.calls[0] as [
            { id: string },
            Record<string, unknown>
        ];
        expect(actorArg.id).toBe(OWNER_ID);
        expect(createInput.name).toBe(VALID_GASTRONOMY_BODY.name);
        expect(createInput.description).toBe(VALID_GASTRONOMY_BODY.description);
        expect(createInput.type).toBe(GastronomyTypeEnum.PARRILLA);
    });

    it('routes the owner create through createForOwner, never the plain create (HOS-687)', async () => {
        const ctx = createMockContext();

        await handleCreateGastronomyListing(ctx as never, VALID_GASTRONOMY_BODY);

        expect(mockCreateForOwner).toHaveBeenCalledTimes(1);
        // `create` alone would insert the listing and grant nothing — the owner
        // would end up locked out of the surface that manages what they just
        // created.
        expect(mockPlainCreate).not.toHaveBeenCalled();
    });

    it('surfaces a service-layer error (e.g. FORBIDDEN) as a ServiceError', async () => {
        mockCreateForOwner.mockResolvedValue({
            error: { code: 'FORBIDDEN', message: 'Permission denied' }
        });
        const ctx = createMockContext();

        await expect(
            handleCreateGastronomyListing(ctx as never, VALID_GASTRONOMY_BODY)
        ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
});
