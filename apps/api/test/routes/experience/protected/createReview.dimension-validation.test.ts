/**
 * AC:3:13 (HOS-1842 / 3.10) — experience review over the real protected HTTP
 * route (`POST /api/v1/protected/experiences/:experienceId/reviews`).
 *
 * Experience keeps its legacy four-dimension breakdown (DEC-FAC-073): a review
 * that votes all four dimensions must succeed exactly as it does today. The
 * route runs the real `ExperienceReviewService._beforeCreate`; only the DB
 * models are stubbed.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const EXPERIENCE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const REVIEW_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const BASE = '/api/v1/protected/experiences';

const fixtures = vi.hoisted(() => ({
    experience: null as Record<string, unknown> | null,
    rejectionReason: null as string | null
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const orig = await importOriginal<typeof import('@repo/service-core')>();

    const reviewModel = {
        findOne: async () => null,
        findAll: async () => ({ items: [], total: 0 }),
        findOneWithRelations: async () => null,
        create: async (data: Record<string, unknown>) => ({
            ...data,
            id: REVIEW_ID,
            moderationState: 'PENDING',
            lifecycleState: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date()
        })
    };
    const experienceModel = { findById: async () => fixtures.experience };
    const experienceService = { recomputeRating: async () => undefined };

    class ExperienceReviewService extends orig.ExperienceReviewService {
        constructor(config: ConstructorParameters<typeof orig.ExperienceReviewService>[0]) {
            super(config);
            const self = this as unknown as {
                model: unknown;
                _experienceModel: unknown;
                _experienceService: unknown;
            };
            self.model = reviewModel;
            self._experienceModel = experienceModel;
            self._experienceService = experienceService;
        }

        async create(...args: Parameters<typeof orig.ExperienceReviewService.prototype.create>) {
            if (fixtures.rejectionReason) {
                return {
                    error: {
                        code: 'VALIDATION_ERROR' as never,
                        message: 'Validation rejected',
                        reason: fixtures.rejectionReason,
                        details: { field: 'internal.secret', reason: fixtures.rejectionReason }
                    }
                } as unknown as Awaited<
                    ReturnType<typeof orig.ExperienceReviewService.prototype.create>
                >;
            }
            return super.create(...args);
        }
    }

    return { ...orig, ExperienceReviewService };
});

const actorHeaders = {
    'content-type': 'application/json',
    'user-agent': 'vitest',
    'x-mock-actor-role': 'USER',
    'x-mock-actor-id': ACTOR_ID,
    'x-mock-actor-permissions': '[]'
};

describe('AC:3:13 — experience review with the four dimensions over HTTP', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
        fixtures.experience = {
            id: EXPERIENCE_ID,
            ownerId: OWNER_ID,
            publicationStatus: 'PUBLISHED',
            businessLines: ['standard']
        };
    });

    beforeEach(() => {
        fixtures.rejectionReason = null;
    });

    it('hides details for other VALIDATION_ERROR reasons', async () => {
        fixtures.rejectionReason = 'INTERNAL_VALIDATION';
        const res = await app.request(`${BASE}/${EXPERIENCE_ID}/reviews`, {
            method: 'POST',
            headers: actorHeaders,
            body: JSON.stringify({
                overallRating: 5,
                rating: { food: 4, service: 4, ambiance: 4, value: 4 }
            })
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(body.error.details).toBeUndefined();
    });

    it('accepts a review that votes food, service, ambiance and value', async () => {
        const res = await app.request(`${BASE}/${EXPERIENCE_ID}/reviews`, {
            method: 'POST',
            headers: actorHeaders,
            body: JSON.stringify({
                overallRating: 5,
                rating: { food: 5, service: 4, ambiance: 4, value: 5 }
            })
        });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.success).toBe(true);
    });
});
