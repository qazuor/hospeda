import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders, createOwner, readResponse } from './publication-routes.helpers';

const app = initApp();

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
afterAll(async () => testDb.teardown());

describe('TEST:1760:1 moderation state route', () => {
    it('returns 403 for an unknown id before looking up the listing without permission', async () => {
        const admin = await createOwner();
        const response = await readResponse(
            await app.request(
                '/api/v1/admin/accommodations/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/moderation',
                {
                    headers: actorHeaders({
                        id: admin.id,
                        role: RoleEnum.ADMIN,
                        permissions: [
                            PermissionEnum.ACCESS_PANEL_ADMIN,
                            PermissionEnum.ACCESS_API_ADMIN
                        ]
                    })
                }
            )
        );
        expect(response.status).toBe(403);
    });
});
