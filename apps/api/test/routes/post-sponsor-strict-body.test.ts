/**
 * Real-route HTTP strict-body test for HOS-106.
 *
 * Exercises an actual affected production route end-to-end — `POST
 * /api/v1/admin/post-sponsors`, whose `PostSponsorCreateInputSchema` is `.strict()`
 * and flows through `createOpenAPISchema` — with the real admin middleware chain,
 * a mocked service (no DB). Proves two things the fix + coupled schema change
 * must guarantee at the HTTP boundary:
 *   1. an unknown body key is rejected with 400 (the strict enforcement), and
 *   2. `lifecycleState` (which the admin form submits, previously `.omit()`'d) is
 *      accepted and reaches the service.
 */

import type { Mock } from 'vitest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const postSponsorRef: { create: Mock } = {
    create: vi.fn()
};

// initApp() instantiates models at module scope that reach `getDb()`; mock the
// DB layer so construction succeeds without a real connection (same technique as
// ai-sync-models.integration.test.ts).
vi.mock('@repo/db', async () => {
    const { createDbMock } = await import('../helpers/mocks/db-mock.js');
    return { ...createDbMock() };
});

// Keep the real @repo/service-core (real ServiceError for the route error path)
// but swap PostSponsorService for a stub so no query runs.
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        PostSponsorService: vi.fn().mockImplementation(function () {
            return {
                create: (...args: unknown[]) => postSponsorRef.create(...args)
            };
        })
    };
});

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { initApp } from '../../src/app';
import type { AppOpenAPI } from '../../src/types';
import { validateApiEnv } from '../../src/utils/env';

const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function adminHeaders(): Record<string, string> {
    return {
        'content-type': 'application/json',
        accept: 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': ACTOR_ID,
        'x-mock-actor-role': RoleEnum.SUPER_ADMIN,
        // A sponsor-managing admin actor. The route's guard requires the full
        // sponsor permission set plus MANAGE_CONTENT, not just POST_SPONSOR_CREATE.
        'x-mock-actor-permissions': JSON.stringify([
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.ACCESS_API_ADMIN,
            PermissionEnum.POST_SPONSOR_CREATE,
            PermissionEnum.POST_SPONSOR_UPDATE,
            PermissionEnum.POST_SPONSOR_VIEW,
            PermissionEnum.MANAGE_CONTENT
        ])
    };
}

const validCreateBody = {
    name: 'Acme Sponsor Co',
    type: 'POST_SPONSOR',
    description: 'A sufficiently long sponsor description for validation.'
};

describe('POST /admin/post-sponsors — strict body enforcement (HOS-106)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    beforeEach(() => {
        postSponsorRef.create = vi.fn().mockResolvedValue({ data: {}, error: undefined });
    });

    it('rejects a body with an unknown key (400, service not called)', async () => {
        const res = await app.request('/api/v1/admin/post-sponsors', {
            method: 'POST',
            headers: adminHeaders(),
            body: JSON.stringify({ ...validCreateBody, notAField: 'boom' })
        });

        expect(res.status).toBe(400);
        // Rejection happens at the validator, before the handler/service runs.
        expect(postSponsorRef.create).not.toHaveBeenCalled();
    });

    it('accepts lifecycleState in the body (validation passes → service is called)', async () => {
        const res = await app.request('/api/v1/admin/post-sponsors', {
            method: 'POST',
            headers: adminHeaders(),
            body: JSON.stringify({ ...validCreateBody, lifecycleState: 'DRAFT' })
        });

        // The body passed validation (lifecycleState no longer rejected), so the
        // handler ran and invoked the service. Not a 400 validation error.
        expect(res.status).not.toBe(400);
        expect(postSponsorRef.create).toHaveBeenCalledTimes(1);
    });
});
