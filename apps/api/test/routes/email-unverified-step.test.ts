/** TEST:V5:3 — step 2 precedes the permission gate on protected routes. */
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { EMAIL_UNVERIFIED_ALLOWED_OPERATIONS } from '@repo/verticals';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { AppBindings } from '../../src/types';
import { createProtectedRoute } from '../../src/utils/route-factory';

const actorId = '11111111-1111-4111-8111-111111111111';
const actor = (emailVerified: boolean, guest = false) => ({
    id: actorId,
    roles: [guest ? RoleEnum.GUEST : RoleEnum.USER],
    permissions: [],
    emailVerified
});

function buildApp(emailVerified: boolean, guest = false): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.onError((error, c) => {
        if (error instanceof HTTPException) {
            return c.json(
                {
                    error: {
                        code:
                            error.status === 401
                                ? ServiceErrorCode.UNAUTHORIZED
                                : ServiceErrorCode.FORBIDDEN,
                        message: error.message
                    }
                },
                error.status
            );
        }
        throw error;
    });
    app.use((c, next) => {
        c.set('actor', actor(emailVerified, guest));
        return next();
    });
    const basic = createProtectedRoute({
        method: 'get',
        path: '/basic',
        summary: 'Basic',
        description: 'Basic',
        tags: ['Test'],
        responseSchema: z.object({ ok: z.boolean() }),
        handler: async () => ({ ok: true })
    });
    const permission = createProtectedRoute({
        method: 'get',
        path: '/permission',
        summary: 'Permission',
        description: 'Permission',
        tags: ['Test'],
        requiredPermissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
        responseSchema: z.object({ ok: z.boolean() }),
        handler: async () => ({ ok: true })
    });
    app.route('/', basic);
    app.route('/', permission);
    for (const operation of EMAIL_UNVERIFIED_ALLOWED_OPERATIONS) {
        app.route(
            '/',
            createProtectedRoute({
                method: 'get',
                path: `/${operation}`,
                summary: operation,
                description: operation,
                tags: ['Test'],
                emailUnverifiedOperation: operation,
                responseSchema: z.object({ ok: z.boolean() }),
                handler: async () => ({ ok: true })
            })
        );
    }
    return app;
}

async function probe(app: Hono<AppBindings>, path: string) {
    const response = await app.request(path);
    const body = (await response.json()) as Record<string, unknown>;
    if (body.metadata && typeof body.metadata === 'object') {
        const { metadata, ...rest } = body;
        return {
            status: response.status,
            body: { ...rest, metadataKeys: Object.keys(metadata).sort() }
        };
    }
    return { status: response.status, body };
}

describe('TEST:V5:3 email-unverified step', () => {
    it('returns the same step-2 refusal with and without a permission gate', async () => {
        const app = buildApp(false);
        const basic = await probe(app, '/basic');
        const permission = await probe(app, '/permission');
        expect(basic).toEqual(permission);
        expect(basic.status).toBe(403);
        expect((basic.body as { error: { code: string } }).error.code).toBe(
            ServiceErrorCode.EMAIL_NOT_VERIFIED
        );
    });

    it.each(EMAIL_UNVERIFIED_ALLOWED_OPERATIONS)('passes %s through step 2', async (operation) => {
        const response = await buildApp(false).request(`/${operation}`);
        expect(response.status).toBe(200);
        expect((await response.json()).data).toEqual({ ok: true });
    });

    it('still applies permissions after a verified person passes step 2', async () => {
        const result = await probe(buildApp(true), '/permission');
        expect(result.status).toBe(403);
        expect((result.body as { error: { code: string } }).error.code).toBe(
            ServiceErrorCode.FORBIDDEN
        );
    });

    it('rejects a guest before step 2', async () => {
        const result = await probe(buildApp(false, true), '/basic');
        expect(result.status).toBe(401);
    });
});
