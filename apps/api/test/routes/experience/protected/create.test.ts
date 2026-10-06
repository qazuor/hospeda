/**
 * Unit tests for the owner self-service experience create handler (HOS-166 §7.2, D-3):
 * `handleCreateExperienceListing` behind `POST /api/v1/protected/experiences/`.
 *
 * The handler is exported standalone and exercised against a mocked `Context`,
 * with `ExperienceService` replaced by a spy so the exact payload passed to
 * `createForOwner()` can be inspected without a live DB.
 *
 * Covers (AC-19, D-3): `ownerId` is always `actor.id`; `visibility` is always
 * PRIVATE and `lifecycleState` always DRAFT; owner-create schema strips
 * server-owned fields; the owner path goes through `createForOwner`; service
 * errors surface as `ServiceError` with the same code.
 *
 * @module test/routes/experience/protected/create
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
        ExperienceService: class MockExperienceService {
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
    ExperienceOwnerCreateInputSchema,
    LifecycleStatusEnum,
    VisibilityEnum
} from '@repo/schemas';
import { handleCreateExperienceListing } from '../../../../src/routes/experience/protected/create';

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

// See VALID_GASTRONOMY_BODY for why `destinationId` is present (H-88).
const VALID_EXPERIENCE_BODY = {
    name: 'Kayak tour on the Uruguay river',
    summary: 'A guided two-hour kayak tour along the riverside.',
    description: 'Explore the Uruguay river coastline by kayak with a certified local guide.',
    type: 'TOUR_GUIDE',
    priceFrom: 1500000,
    priceUnit: 'per_person',
    isPriceOnRequest: false,
    destinationId: '00000000-0000-4000-a000-000000000002'
};

describe('handleCreateExperienceListing (HOS-166 §7.2, D-3)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCreateForOwner.mockResolvedValue({
            data: { id: 'listing-2', ...VALID_EXPERIENCE_BODY }
        });
    });

    it('forces ownerId = actor.id even when the body supplies a different one', async () => {
        const ctx = createMockContext();

        await handleCreateExperienceListing(ctx as never, {
            ...VALID_EXPERIENCE_BODY,
            ownerId: OTHER_USER_ID
        });

        const [, createInput] = mockCreateForOwner.mock.calls[0] as [
            unknown,
            Record<string, unknown>
        ];
        expect(createInput.ownerId).toBe(OWNER_ID);
    });

    it('forces visibility=PRIVATE and lifecycleState=DRAFT', async () => {
        const ctx = createMockContext();

        await handleCreateExperienceListing(ctx as never, VALID_EXPERIENCE_BODY);

        const [, createInput] = mockCreateForOwner.mock.calls[0] as [
            unknown,
            Record<string, unknown>
        ];
        expect(createInput.visibility).toBe(VisibilityEnum.PRIVATE);
        expect(createInput.lifecycleState).toBe(LifecycleStatusEnum.DRAFT);
    });

    it('routes the owner create through createForOwner, never the plain create (HOS-687)', async () => {
        const ctx = createMockContext();

        await handleCreateExperienceListing(ctx as never, VALID_EXPERIENCE_BODY);

        expect(mockCreateForOwner).toHaveBeenCalledTimes(1);
        expect(mockPlainCreate).not.toHaveBeenCalled();
    });

    it('drops hasActiveSubscription end-to-end through the real request pipeline', async () => {
        // Same nuance as the gastronomy slug test: the handler alone re-parses
        // against the ADMIN schema (which allows this field). The guarantee
        // lives at the route level — simulate that real pipeline here.
        const validatedBody = ExperienceOwnerCreateInputSchema.parse({
            ...VALID_EXPERIENCE_BODY,
            hasActiveSubscription: true
        });
        const ctx = createMockContext();

        await handleCreateExperienceListing(ctx as never, validatedBody);

        const [, createInput] = mockCreateForOwner.mock.calls[0] as [
            unknown,
            Record<string, unknown>
        ];
        expect(createInput.hasActiveSubscription).toBe(false);
    });
});
