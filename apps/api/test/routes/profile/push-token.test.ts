/**
 * @file push-token.test.ts
 *
 * Unit tests for the push-token registration handler (SPEC-243 T-011).
 *
 * Tests the PURE handler with stubbed services and a minimal Hono-context
 * stub.  No initApp, no real DB, no auth middleware — pure unit test.
 */

import { ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    type PushTokenDeps,
    type PushTokenUserService,
    registerPushTokenHandler
} from '../../../src/routes/profile/protected/push-token';

// ---------------------------------------------------------------------------
// Shared test infrastructure
// ---------------------------------------------------------------------------

const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/** Build a minimal actor for context.get('actor'). */
const buildActor = () => ({
    id: ACTOR_ID,
    email: 'user@example.com',
    role: 'USER' as const,
    permissions: [] as string[]
});

/** Build a minimal Hono context stub. */
const buildCtx = () => {
    const actor = buildActor();
    return {
        get: (key: string) => (key === 'actor' ? actor : undefined),
        req: {
            header: (_name: string) => undefined,
            raw: { headers: new Headers() }
        }
    } as unknown as Parameters<typeof registerPushTokenHandler>[0];
};

const makeUserSvc = (): PushTokenUserService => ({
    registerPushToken: vi.fn().mockResolvedValue({
        data: { registered: true },
        error: null
    })
});

// ---------------------------------------------------------------------------
// registerPushTokenHandler
// ---------------------------------------------------------------------------

describe('registerPushTokenHandler', () => {
    it('returns { registered: true } on success', async () => {
        const deps: PushTokenDeps = { userService: makeUserSvc() };
        const ctx = buildCtx();
        const result = await registerPushTokenHandler(
            ctx,
            { token: 'ExponentPushToken[abc]', platform: 'ios' },
            deps
        );
        expect(result.registered).toBe(true);
    });

    it('calls registerPushToken with the actor and correct body fields', async () => {
        const userSvc = makeUserSvc();
        const deps: PushTokenDeps = { userService: userSvc };
        const ctx = buildCtx();

        await registerPushTokenHandler(
            ctx,
            { token: 'ExponentPushToken[xyz]', platform: 'android' },
            deps
        );

        expect(userSvc.registerPushToken).toHaveBeenCalledWith(
            expect.objectContaining({ id: ACTOR_ID }),
            { token: 'ExponentPushToken[xyz]', platform: 'android' }
        );
    });

    it('throws ServiceError when userService returns an error', async () => {
        const deps: PushTokenDeps = {
            userService: {
                registerPushToken: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'DB failure' }
                })
            }
        };
        const ctx = buildCtx();
        await expect(
            registerPushTokenHandler(ctx, { token: 'ExponentPushToken[x]', platform: 'ios' }, deps)
        ).rejects.toThrow(/DB failure/);
    });

    it('throws ServiceError when userService returns null data with no error', async () => {
        const deps: PushTokenDeps = {
            userService: {
                registerPushToken: vi.fn().mockResolvedValue({ data: null, error: null })
            }
        };
        const ctx = buildCtx();
        await expect(
            registerPushTokenHandler(ctx, { token: 'ExponentPushToken[x]', platform: 'ios' }, deps)
        ).rejects.toThrow(/registerPushToken returned no data/);
    });
});
