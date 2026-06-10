const { createAdminRouteMock, getModerationEngineHealthMock } = vi.hoisted(() => ({
    createAdminRouteMock: vi.fn((config) => config),
    getModerationEngineHealthMock: vi.fn(() => ({
        provider: 'stub',
        cacheSize: 2,
        hitRatioLastHour: 0.5,
        degradedCountLast24Hours: 1,
        lastProviderErrorAt: '2026-06-07T00:00:00.000Z',
        lastDegradedAt: '2026-06-07T00:05:00.000Z'
    }))
}));

vi.mock('../../../src/utils/route-factory.js', () => ({
    createAdminRoute: createAdminRouteMock
}));

vi.mock('@repo/content-moderation/engine/index', () => ({
    getModerationEngineHealth: getModerationEngineHealthMock
}));

import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('adminContentModerationHealthRoute', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('declares the moderation view permission and expected path', async () => {
        await import('../../../src/routes/content-moderation/admin/health.js');

        expect(createAdminRouteMock).toHaveBeenCalledTimes(1);
        const config = createAdminRouteMock.mock.calls[0]?.[0];

        expect(config.path).toBe('/health');
        expect(config.requiredPermissions).toEqual([PermissionEnum.MODERATION_TERM_VIEW]);
    });

    it('wires the handler to the moderation engine health helper', async () => {
        const module = await import('../../../src/routes/content-moderation/admin/health.js');
        const config = module.adminContentModerationHealthRoute as unknown as {
            handler: () => Promise<{ provider: string; degradedCountLast24Hours: number }>;
        };
        const result = await config.handler();

        expect(getModerationEngineHealthMock).toHaveBeenCalledTimes(1);
        expect(result.provider).toBe('stub');
        expect(result.degradedCountLast24Hours).toBe(1);
    });
});
