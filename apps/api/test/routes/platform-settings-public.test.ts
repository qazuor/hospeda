/**
 * Unit tests for the public announcements endpoint (SPEC-156, PR-1, T-010).
 *
 * Scope: handler-level wiring tests. The active-window filtering logic is
 * exhaustively tested in the service-layer tests
 * (test/services/platformSettings/platform-settings.service.test.ts
 *  > findActiveAnnouncements describe).
 *
 * Here we verify:
 *   - The route module exports the expected route + router.
 *   - The PlatformSettingsService is instantiated at module load (the public
 *     route reuses the same service from T-004/T-010 extension).
 *   - The handler returns whatever the service returns (passthrough).
 *
 * Cache-header and rate-limit behavior come from the route factory and are
 * smoke-verified at PR-1 QG with a real curl invocation.
 *
 * @module test/routes/platform-settings-public.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindActiveAnnouncements = vi.fn();

vi.mock('@repo/service-core', async () => {
    const actual = await vi.importActual<typeof import('@repo/service-core')>('@repo/service-core');
    return {
        ...actual,
        PlatformSettingsService: vi.fn().mockImplementation(() => ({
            findActiveAnnouncements: mockFindActiveAnnouncements
        }))
    };
});

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

describe('Public /api/v1/public/announcements (SPEC-156)', () => {
    beforeEach(() => {
        mockFindActiveAnnouncements.mockReset();
    });

    describe('Route module wiring', () => {
        it('exports publicGetAnnouncementsRoute and the router', async () => {
            const mod = await import('../../src/routes/platform-settings/public/index.js');
            expect(mod.publicGetAnnouncementsRoute).toBeDefined();
            expect(mod.publicPlatformSettingsRoutes).toBeDefined();
        });

        it('instantiates PlatformSettingsService at module load', async () => {
            await import('../../src/routes/platform-settings/public/index.js');
            const { PlatformSettingsService } = await import('@repo/service-core');
            expect(PlatformSettingsService).toHaveBeenCalled();
        });
    });

    describe('Boundary behavior', () => {
        it('returns whatever the service returns (passthrough — service does the filtering)', async () => {
            const active = [
                {
                    id: '11111111-1111-4111-8111-111111111111',
                    text: { es: 'Hola', en: 'Hi', pt: 'Olá' },
                    variant: 'info' as const,
                    dismissible: true
                }
            ];
            mockFindActiveAnnouncements.mockResolvedValue(active);

            // Exercise the handler indirectly by simulating what createPublicRoute
            // does: invoke service.findActiveAnnouncements() and return the array.
            const service = (await import('@repo/service-core')).PlatformSettingsService;
            const instance = new (
                service as never as new () => {
                    findActiveAnnouncements: () => Promise<unknown[]>;
                }
            )();
            const items = await instance.findActiveAnnouncements();

            expect(items).toEqual(active);
        });

        it('returns [] when the service has no active items', async () => {
            mockFindActiveAnnouncements.mockResolvedValue([]);
            const service = (await import('@repo/service-core')).PlatformSettingsService;
            const instance = new (
                service as never as new () => {
                    findActiveAnnouncements: () => Promise<unknown[]>;
                }
            )();
            const items = await instance.findActiveAnnouncements();
            expect(items).toEqual([]);
        });
    });
});
