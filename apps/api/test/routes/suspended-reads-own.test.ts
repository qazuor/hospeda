/** TEST:V5:7 — self profile reading does not require billing coverage. */
import { RoleEnum, UserSchema } from '@repo/schemas';
import { UserService } from '@repo/service-core';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../src/types';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';

describe('TEST:V5:7 suspended owner self read', () => {
    it('returns Mi Cuenta without a billing gate', async () => {
        const profile = UserSchema.parse({
            id: OWNER_ID,
            slug: 'suspended-owner',
            firstName: 'Owner',
            email: 'owner@example.test',
            createdAt: new Date('2026-01-01T00:00:00Z'),
            updatedAt: new Date('2026-01-01T00:00:00Z'),
            createdById: null,
            updatedById: null
        });
        const getById = vi
            .spyOn(UserService.prototype, 'getById')
            .mockResolvedValue({ data: profile });
        const { protectedGetUserByIdRoute } = await import(
            '../../src/routes/user/protected/getById.js'
        );
        const app = new Hono<AppBindings>();
        app.use((c, next) => {
            c.set('actor', {
                id: OWNER_ID,
                roles: [RoleEnum.USER],
                permissions: []
            });
            return next();
        });
        app.route('/', protectedGetUserByIdRoute);
        const response = await app.request(`/${OWNER_ID}`);
        expect(response.status).toBe(200);
        expect(getById).toHaveBeenCalledOnce();
        expect(getById.mock.calls[0]?.[1]).toBe(OWNER_ID);
        vi.restoreAllMocks();
    });
});
