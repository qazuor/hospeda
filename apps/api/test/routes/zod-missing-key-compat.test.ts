/**
 * Regression pin for the zod 4.3.6 -> 4.6 bump (HOS-1774).
 *
 * zod 4.6 treats an object key whose schema accepts `undefined`
 * (`z.unknown()`, `z.any()`, ...) as REQUIRED, rejecting a body that omits
 * it with "expected nonoptional". zod 4.3.6 accepted the omission. The admin
 * route schemas below must keep the 4.3.6 accepted set, so each one is
 * captured from the `createAdminRoute` call and parsed with the key missing.
 *
 * @module test/routes/zod-missing-key-compat.test
 */

import { describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';

const captured = vi.hoisted(() => ({
    routes: [] as Array<{ path: string; requestBody?: unknown; responseSchema?: unknown }>
}));

vi.mock('../../src/utils/route-factory.js', async () => {
    const actual = await vi.importActual<typeof import('../../src/utils/route-factory.js')>(
        '../../src/utils/route-factory.js'
    );
    return {
        ...actual,
        createAdminRoute: (options: { path: string; requestBody?: unknown }) => {
            captured.routes.push(options);
            return actual.createAdminRoute(options as never);
        }
    };
});

vi.mock('@repo/service-core', async () => {
    const actual = await vi.importActual<typeof import('@repo/service-core')>('@repo/service-core');
    return {
        ...actual,
        PlatformSettingsService: vi.fn().mockImplementation(function () {
            return { get: vi.fn(), upsert: vi.fn() };
        })
    };
});

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const findBody = (path: string, moduleMarker: string): z.ZodTypeAny => {
    const route = captured.routes.find((r) => r.path === path && r.requestBody);
    if (!route) throw new Error(`no captured route body for ${moduleMarker} ${path}`);
    return route.requestBody as z.ZodTypeAny;
};

describe('admin route body schemas accept a missing unknown-typed key (zod 4.3.6 parity)', () => {
    it.each([
        ['platform-settings', '../../src/routes/platform-settings/admin/index.js', '/{key}', {}],
        [
            'billing-deadlines preview',
            '../../src/routes/billing-deadlines/admin/index.js',
            '/preview',
            { key: 10 }
        ],
        [
            'vertical-deadlines preview',
            '../../src/routes/vertical-deadlines/admin/index.js',
            '/preview',
            { key: 1 }
        ]
    ] as const)('%s', async (name, modulePath, path, body) => {
        captured.routes.length = 0;
        vi.resetModules();
        await import(/* @vite-ignore */ modulePath);
        const schema = findBody(path, name);
        const result = schema.safeParse(body);
        expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    });
});
