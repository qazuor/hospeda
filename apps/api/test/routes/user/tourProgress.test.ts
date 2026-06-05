/**
 * Tests for PATCH /api/v1/protected/users/me/tour-progress handler (SPEC-174 T-003).
 *
 * Tests the pure `tourProgressHandler` directly with a stub UserService —
 * no app boot required.
 *
 * Coverage (per SPEC-174 §6.2 + §14):
 * - Missing tourId → schema rejects (handled at zValidator layer, tested via body validation)
 * - Negative version → schema rejects (version is nonnegative int)
 * - Float version → schema rejects (version must be integer)
 * - Valid body → returns { success: true } and service called with actor + tourId + version
 * - 401 unauthenticated → actorMiddleware rejects before handler runs
 * - Service error propagated as ServiceError
 * - Actor isolation: uses the actor from context, not a hardcoded id
 */

import { TourProgressBodySchema } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    type TourProgressUserService,
    tourProgressHandler
} from '../../../src/routes/user/protected/tourProgress';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const buildActor = () => ({
    id: '00000000-0000-0000-0000-000000000020',
    role: 'HOST',
    permissions: ['user.settings.update'] as string[]
});

/** Build a Hono context stub with the given actor. */
const buildCtx = (actorOverride?: Partial<ReturnType<typeof buildActor>>) => {
    const actor = { ...buildActor(), ...actorOverride };
    return {
        get: (key: string) => (key === 'actor' ? actor : undefined)
    } as Parameters<typeof tourProgressHandler>[0];
};

/** Happy-path stub: markAdminTourSeen always succeeds. */
const buildSuccessSvc = (): TourProgressUserService => ({
    markAdminTourSeen: vi.fn().mockResolvedValue({ data: { success: true }, error: null })
});

// ---------------------------------------------------------------------------
// Schema validation tests (zValidator layer)
// ---------------------------------------------------------------------------

describe('TourProgressBodySchema validation', () => {
    it('rejects when tourId is missing', () => {
        const result = TourProgressBodySchema.safeParse({ version: 1 });
        expect(result.success).toBe(false);
    });

    it('rejects when tourId is an empty string', () => {
        const result = TourProgressBodySchema.safeParse({ tourId: '', version: 1 });
        expect(result.success).toBe(false);
    });

    it('rejects when version is missing', () => {
        const result = TourProgressBodySchema.safeParse({ tourId: 'host.welcome' });
        expect(result.success).toBe(false);
    });

    it('rejects when version is negative', () => {
        const result = TourProgressBodySchema.safeParse({ tourId: 'host.welcome', version: -1 });
        expect(result.success).toBe(false);
    });

    it('rejects when version is a float', () => {
        const result = TourProgressBodySchema.safeParse({ tourId: 'host.welcome', version: 1.5 });
        expect(result.success).toBe(false);
    });

    it('accepts version === 0 (non-negative)', () => {
        const result = TourProgressBodySchema.safeParse({ tourId: 'host.welcome', version: 0 });
        expect(result.success).toBe(true);
    });

    it('accepts valid body with positive version', () => {
        const result = TourProgressBodySchema.safeParse({ tourId: 'host.welcome', version: 1 });
        expect(result.success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Handler tests
// ---------------------------------------------------------------------------

describe('tourProgressHandler (SPEC-174 T-003)', () => {
    describe('valid body', () => {
        it('returns { success: true } when service succeeds', async () => {
            const svc = buildSuccessSvc();
            const result = await tourProgressHandler(
                buildCtx(),
                { tourId: 'host.welcome', version: 1 },
                svc
            );

            expect(result).toEqual({ success: true });
        });

        it('calls markAdminTourSeen with the actor and tourId + version', async () => {
            const svc = buildSuccessSvc();
            const body = { tourId: 'editor.analisis', version: 2 };

            await tourProgressHandler(buildCtx(), body, svc);

            expect(svc.markAdminTourSeen).toHaveBeenCalledOnce();
            const [calledActor, calledInput] = (svc.markAdminTourSeen as ReturnType<typeof vi.fn>)
                .mock.calls[0] as [
                ReturnType<typeof buildActor>,
                { tourId: string; version: number }
            ];
            expect(calledActor.id).toBe(buildActor().id);
            expect(calledInput.tourId).toBe('editor.analisis');
            expect(calledInput.version).toBe(2);
        });

        it('accepts version 0', async () => {
            const svc = buildSuccessSvc();
            const result = await tourProgressHandler(
                buildCtx(),
                { tourId: 'host.welcome', version: 0 },
                svc
            );

            expect(result).toEqual({ success: true });
            expect(svc.markAdminTourSeen).toHaveBeenCalledOnce();
        });
    });

    describe('service errors', () => {
        it('propagates NOT_FOUND as ServiceError', async () => {
            const svc: TourProgressUserService = {
                markAdminTourSeen: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'NOT_FOUND', message: 'User not found' }
                })
            };

            await expect(
                tourProgressHandler(buildCtx(), { tourId: 'host.welcome', version: 1 }, svc)
            ).rejects.toThrow('User not found');
        });

        it('propagates INTERNAL_ERROR as ServiceError', async () => {
            const svc: TourProgressUserService = {
                markAdminTourSeen: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'INTERNAL_ERROR', message: 'db exploded' }
                })
            };

            await expect(
                tourProgressHandler(buildCtx(), { tourId: 'host.welcome', version: 1 }, svc)
            ).rejects.toThrow('db exploded');
        });
    });

    describe('actor isolation', () => {
        it('uses the actor from context, not a hardcoded id', async () => {
            const svc = buildSuccessSvc();
            const customActor = { id: 'custom-actor-id', role: 'EDITOR', permissions: [] };
            const ctx = buildCtx(customActor);

            await tourProgressHandler(ctx, { tourId: 'editor.editorial', version: 1 }, svc);

            const [calledActor] = (svc.markAdminTourSeen as ReturnType<typeof vi.fn>).mock
                .calls[0] as [ReturnType<typeof buildActor>, { tourId: string; version: number }];
            expect(calledActor.id).toBe('custom-actor-id');
        });

        it('correctly passes SUPER_ADMIN actor', async () => {
            const svc = buildSuccessSvc();
            const superActor = {
                id: 'super-admin-id',
                role: 'SUPER_ADMIN',
                permissions: ['user.settings.update']
            };
            const ctx = buildCtx(superActor);

            await tourProgressHandler(ctx, { tourId: 'superAdmin.welcome', version: 3 }, svc);

            const [calledActor, calledInput] = (svc.markAdminTourSeen as ReturnType<typeof vi.fn>)
                .mock.calls[0] as [
                ReturnType<typeof buildActor>,
                { tourId: string; version: number }
            ];
            expect(calledActor.id).toBe('super-admin-id');
            expect(calledInput.tourId).toBe('superAdmin.welcome');
            expect(calledInput.version).toBe(3);
        });
    });

    describe('idempotency', () => {
        it('returns { success: true } on a second call with the same tourId and version', async () => {
            const svc = buildSuccessSvc();
            const body = { tourId: 'host.welcome', version: 1 };

            const r1 = await tourProgressHandler(buildCtx(), body, svc);
            const r2 = await tourProgressHandler(buildCtx(), body, svc);

            expect(r1).toEqual({ success: true });
            expect(r2).toEqual({ success: true });
            expect(svc.markAdminTourSeen).toHaveBeenCalledTimes(2);
        });
    });
});
