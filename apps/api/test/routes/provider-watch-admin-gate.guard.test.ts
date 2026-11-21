/**
 * HOS-1512 D2: every provider watch admin route is gated by the dedicated SUPER_ADMIN-only
 * permission. A static guard over the source: one slice per route, because asserting over the whole
 * file would pass while one route lost its gate. The route handlers are not reachable through the
 * mocked test harness (see apps/api/CLAUDE.md), so the gate is checked where it is declared.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
    resolve(import.meta.dirname, '../../src/routes/provider-watch/admin/index.ts'),
    'utf8'
);
const ROUTES = [
    'adminGetProviderWatchAccountRoute',
    'adminProviderWatchAuthorizationPreviewRoute',
    'adminAuthorizeProviderWatchRoute',
    'adminListProviderWatchShapesRoute',
    'adminAcceptProviderWatchShapeRoute'
] as const;

function slice(name: string): string {
    const start = SOURCE.indexOf(`export const ${name} = createAdminRoute(`);
    expect(start, `${name} is declared`).toBeGreaterThan(-1);
    const next = SOURCE.indexOf('\nexport const ', start + 10);
    const routerStart = SOURCE.indexOf('\nconst router', start);
    return SOURCE.slice(start, next === -1 ? routerStart : Math.min(next, routerStart));
}

describe('provider watch admin routes are gated by BILLING_PROVIDER_WATCH_MANAGE', () => {
    it.each(ROUTES)('%s requires exactly BILLING_PROVIDER_WATCH_MANAGE', (name) => {
        const block = slice(name);
        expect(block).toContain(
            'requiredPermissions: [PermissionEnum.BILLING_PROVIDER_WATCH_MANAGE]'
        );
        expect(block).not.toContain('MAINTENANCE_MODE_WRITE');
        expect(block).not.toContain('BILLING_SETTINGS');
    });

    it('proves the slicing cuts: one route block does not contain another', () => {
        expect(slice('adminGetProviderWatchAccountRoute')).not.toContain("path: '/authorization'");
        expect(slice('adminAcceptProviderWatchShapeRoute')).not.toContain("path: '/account'");
    });

    it('declares exactly the five routes, all mounted', () => {
        const declared = [
            ...SOURCE.matchAll(/export const (admin\w+Route) = createAdminRoute\(/g)
        ].map((match) => match[1]);
        expect(declared).toEqual([...ROUTES]);
        for (const name of ROUTES) expect(SOURCE).toContain(`router.route('/', ${name});`);
    });
});

describe('the authorize route refuses a wrong amount before it reads the provider account', () => {
    it('checks the exact amount, then reads the account, then writes', () => {
        const block = slice('adminAuthorizeProviderWatchRoute');
        const check = block.indexOf('checkAuthorizedAmount(');
        const read = block.indexOf('readConfirmedAccount(');
        const write = block.indexOf('setProviderWatchAuthorization(');
        expect(check).toBeGreaterThan(-1);
        expect(check).toBeLessThan(read);
        expect(read).toBeLessThan(write);
        // A sum of 0 is a valid authorization (F5, 2026-11-18): the route must not refuse it outright.
        expect(block).not.toContain('NO_MONEY_MEASUREMENTS');
    });
});
