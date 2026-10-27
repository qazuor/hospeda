/**
 * Integration tests for public owner-promotion routes.
 *
 * Covers:
 * - GET /api/v1/public/owner-promotions — paginated list
 * - GET /api/v1/public/owner-promotions/:id — get by ID
 *
 * These routes are unauthenticated and read-only. Each test starts from
 * three ACTIVE promotions plus one DRAFT one seeded through Drizzle, so the
 * public visibility gate (ACTIVE only) is exercised against real rows.
 */
import { getDb, ownerPromotions } from '@repo/db';
import { LifecycleStatusEnum, OwnerPromotionDiscountTypeEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { clearCache } from '../../../src/middlewares/cache';
import { validateApiEnv } from '../../../src/utils/env';
import { createTestUser } from '../../e2e/setup/seed-helpers';
import { testDb } from '../../e2e/setup/test-database';

const base = '/api/v1/public/owner-promotions';
const headers = { 'user-agent': 'vitest' };
const ACTIVE_COUNT = 3;

interface SeededPromotions {
    readonly activeIds: readonly string[];
    readonly draftId: string;
}

/**
 * Seeds `ACTIVE_COUNT` ACTIVE promotions and one DRAFT promotion for a fresh owner.
 */
async function seedPromotions(): Promise<SeededPromotions> {
    const suffix = crypto.randomUUID().slice(0, 8);
    const owner = await createTestUser({
        email: `owner-promo-${suffix}@example.test`,
        slug: `owner-promo-${suffix}`
    });
    const validFrom = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await getDb()
        .insert(ownerPromotions)
        .values(
            Array.from({ length: ACTIVE_COUNT + 1 }, (_, index) => ({
                slug: `owner-promo-${index}-${suffix}`,
                ownerId: owner.id,
                title: `Owner promotion ${index} ${suffix}`,
                description: 'Seeded for the public owner-promotion integration tests.',
                discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
                discountValue: 10 + index,
                validFrom,
                lifecycleState:
                    index < ACTIVE_COUNT ? LifecycleStatusEnum.ACTIVE : LifecycleStatusEnum.DRAFT
            }))
        )
        .returning({ id: ownerPromotions.id, lifecycleState: ownerPromotions.lifecycleState });

    const draft = rows.find((row) => row.lifecycleState === LifecycleStatusEnum.DRAFT);
    if (!draft) throw new Error('seedPromotions: draft promotion insert returned no row');
    return {
        activeIds: rows.filter((row) => row.id !== draft.id).map((row) => row.id),
        draftId: draft.id
    };
}

describe('GET /api/v1/public/owner-promotions (list)', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        clearCache();
        validateApiEnv();
        app = initApp();
    });

    beforeEach(async () => {
        await seedPromotions();
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    it('returns 200 with only the ACTIVE promotions on the happy path', async () => {
        // Arrange / Act
        const res = await app.request(base, { headers });

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.items).toHaveLength(ACTIVE_COUNT);
    });

    it('includes pagination metadata', async () => {
        // Arrange / Act
        const res = await app.request(base, { headers });

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.pagination).toMatchObject({
            page: 1,
            total: ACTIVE_COUNT,
            totalPages: 1
        });
        expect(body.data.pagination).toHaveProperty('pageSize');
    });

    it('respects pageSize query parameter', async () => {
        // Arrange / Act
        const res = await app.request(`${base}?pageSize=2`, { headers });

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.pagination.pageSize).toBe(2);
        expect(body.data.items).toHaveLength(2);
    });

    it('accepts the maximum pageSize of 100', async () => {
        // Arrange / Act
        const res = await app.request(`${base}?pageSize=100`, { headers });

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.pagination.pageSize).toBe(100);
    });

    it('rejects a pageSize above the maximum with 400', async () => {
        // Arrange / Act
        const res = await app.request(`${base}?pageSize=500`, { headers });

        // Assert
        expect(res.status).toBe(400);
    });

    it('does not require authentication', async () => {
        // Arrange — no auth headers at all (only the user-agent every client sends)
        // Act
        const res = await app.request(base, { headers });

        // Assert — must NOT return 401
        expect(res.status).not.toBe(401);
        expect(res.status).toBe(200);
    });
});

describe('GET /api/v1/public/owner-promotions/:id', () => {
    let app: ReturnType<typeof initApp>;
    let seeded: SeededPromotions;
    const missingId = '99999999-9999-4999-8999-999999999999';

    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        clearCache();
        validateApiEnv();
        app = initApp();
    });

    beforeEach(async () => {
        seeded = await seedPromotions();
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    it('returns 200 and the promotion for an existing ACTIVE id', async () => {
        // Arrange
        const id = seeded.activeIds[0];

        // Act
        const res = await app.request(`${base}/${id}`, { headers });

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toMatchObject({ id });
    });

    it('returns 404 for a valid UUID that matches no promotion', async () => {
        // Arrange / Act
        const res = await app.request(`${base}/${missingId}`, { headers });

        // Assert
        expect(res.status).toBe(404);
    });

    // HOS-1897: a non-public promotion must be indistinguishable from an unknown id.
    it('returns 404 NOT_FOUND for a DRAFT promotion (HOS-1897)', async () => {
        // Arrange / Act
        const res = await app.request(`${base}/${seeded.draftId}`, { headers });

        // Assert
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.code).toBe('NOT_FOUND');
    });

    it('returns 400 for an invalid UUID format', async () => {
        // Arrange / Act
        const res = await app.request(`${base}/not-a-uuid`, { headers });

        // Assert
        expect(res.status).toBe(400);
    });

    it('does not leak admin-only fields when found', async () => {
        // Arrange
        const id = seeded.activeIds[0];

        // Act
        const res = await app.request(`${base}/${id}`, { headers });

        // Assert — admin fields must not be present
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: Record<string, unknown> };
        expect(body.data).not.toHaveProperty('deletedAt');
        expect(body.data).not.toHaveProperty('deletedById');
        expect(body.data).not.toHaveProperty('lifecycleState');
        expect(body.data).not.toHaveProperty('ownerId');
        expect(body.data).not.toHaveProperty('currentRedemptions');
    });
});
