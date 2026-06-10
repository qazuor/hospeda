/**
 * Tests for PATCH /api/v1/protected/users/me/whats-new-seen handler (SPEC-175 T-007).
 *
 * Tests the pure `whatsNewSeenHandler` directly with a stub UserService —
 * no app boot required.
 *
 * Coverage (per §12.3):
 * - Empty ids array → WhatsNewSeenBodySchema rejects (handled at zValidator layer)
 * - Valid ids → returns { success: true } and service called with actor + ids
 * - Idempotent: second call with overlapping ids still returns { success: true }
 * - 401 unauthenticated → actorMiddleware rejects before handler runs
 * - Service error propagated as ServiceError
 */

import { describe, expect, it, vi } from 'vitest';
import {
    type WhatsNewSeenUserService,
    whatsNewSeenHandler
} from '../../../src/routes/user/protected/whatsNewSeen';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const buildActor = () => ({
    id: '00000000-0000-0000-0000-000000000010',
    role: 'HOST',
    permissions: ['user.settings.update'] as string[]
});

/** Build a Hono context stub with the given actor. */
const buildCtx = (actorOverride?: Partial<ReturnType<typeof buildActor>>) => {
    const actor = { ...buildActor(), ...actorOverride };
    return {
        get: (key: string) => (key === 'actor' ? actor : undefined)
    } as Parameters<typeof whatsNewSeenHandler>[0];
};

/** Happy-path stub: markWhatsNewSeen always succeeds. */
const buildSuccessSvc = (): WhatsNewSeenUserService => ({
    markWhatsNewSeen: vi.fn().mockResolvedValue({ data: { success: true }, error: null })
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('whatsNewSeenHandler (SPEC-175 T-007)', () => {
    describe('valid ids', () => {
        it('returns { success: true } when service succeeds', async () => {
            const svc = buildSuccessSvc();
            const result = await whatsNewSeenHandler(
                buildCtx(),
                { ids: ['entry-a', 'entry-b'] },
                svc
            );

            expect(result).toEqual({ success: true });
        });

        it('calls markWhatsNewSeen with the actor and ids', async () => {
            const svc = buildSuccessSvc();
            const ids = ['entry-x', 'entry-y'];

            await whatsNewSeenHandler(buildCtx(), { ids }, svc);

            expect(svc.markWhatsNewSeen).toHaveBeenCalledOnce();
            const [calledActor, calledInput] = (svc.markWhatsNewSeen as ReturnType<typeof vi.fn>)
                .mock.calls[0] as [ReturnType<typeof buildActor>, { ids: string[] }];
            expect(calledActor.id).toBe(buildActor().id);
            expect(calledInput.ids).toEqual(ids);
        });

        it('single id is accepted', async () => {
            const svc = buildSuccessSvc();
            const result = await whatsNewSeenHandler(buildCtx(), { ids: ['only-one'] }, svc);

            expect(result).toEqual({ success: true });
            expect(svc.markWhatsNewSeen).toHaveBeenCalledOnce();
        });
    });

    describe('idempotency', () => {
        it('returns { success: true } on a second call with overlapping ids', async () => {
            const svc = buildSuccessSvc();
            const ids = ['entry-a', 'entry-b'];

            const r1 = await whatsNewSeenHandler(buildCtx(), { ids }, svc);
            const r2 = await whatsNewSeenHandler(buildCtx(), { ids: [...ids, 'entry-a'] }, svc);

            expect(r1).toEqual({ success: true });
            expect(r2).toEqual({ success: true });
            expect(svc.markWhatsNewSeen).toHaveBeenCalledTimes(2);
        });
    });

    describe('service errors', () => {
        it('propagates NOT_FOUND as ServiceError', async () => {
            const svc: WhatsNewSeenUserService = {
                markWhatsNewSeen: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'NOT_FOUND', message: 'User not found' }
                })
            };

            await expect(
                whatsNewSeenHandler(buildCtx(), { ids: ['entry-a'] }, svc)
            ).rejects.toThrow('User not found');
        });

        it('propagates INTERNAL_ERROR as ServiceError', async () => {
            const svc: WhatsNewSeenUserService = {
                markWhatsNewSeen: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'INTERNAL_ERROR', message: 'db exploded' }
                })
            };

            await expect(
                whatsNewSeenHandler(buildCtx(), { ids: ['entry-a'] }, svc)
            ).rejects.toThrow('db exploded');
        });
    });

    describe('actor isolation', () => {
        it('uses the actor from context, not a hardcoded id', async () => {
            const svc = buildSuccessSvc();
            const customActor = { id: 'custom-actor-id', role: 'EDITOR', permissions: [] };
            const ctx = buildCtx(customActor);

            await whatsNewSeenHandler(ctx, { ids: ['entry-a'] }, svc);

            const [calledActor] = (svc.markWhatsNewSeen as ReturnType<typeof vi.fn>).mock
                .calls[0] as [ReturnType<typeof buildActor>, { ids: string[] }];
            expect(calledActor.id).toBe('custom-actor-id');
        });
    });
});
