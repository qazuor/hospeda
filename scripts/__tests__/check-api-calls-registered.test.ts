import { describe, expect, it } from 'vitest';
import {
    extractApiCalls,
    findStaleExceptions,
    findViolations,
    isRegistered,
    loadRegisteredRoutes,
    scanRepository
} from '../check-api-calls-registered.js';

const routes = loadRegisteredRoutes();
const webFile = 'apps/web/src/lib/api/endpoints-protected.ts';
const adminFile = 'apps/admin/src/features/billing-notification-logs/hooks.ts';

describe('TEST:B13a:23 — guard: no client calls a route the API does not register (AC:B13a:24)', () => {
    it('extracts path templates, fetchApi paths and prefixed fetch templates', () => {
        const source = [
            "const PROTECTED = '/api/v1/protected';",
            "const BASE = '/api/v1/public';",
            'const a = { path: `${PROTECTED}/price-alerts` };',
            "fetchApi({ path: '/api/v1/admin/users' });",
            'fetch(`${getApiUrl()}/api/v1/public/amenities?${q}`);',
            '// fetch(`/api/v1/admin/deleted`);',
            '/* fetch(`/api/v1/admin/deleted-again`); */'
        ].join('\n');
        expect(extractApiCalls({ file: webFile, source })).toEqual([
            { file: webFile, line: 3, route: '/api/v1/protected/price-alerts' },
            { file: webFile, line: 4, route: '/api/v1/admin/users' },
            { file: webFile, line: 5, route: '/api/v1/public/amenities' }
        ]);
    });

    it('matches params, call wildcards, query-free paths and explicit prefix wildcards', () => {
        const registered = [
            { method: 'GET', path: '/api/v1/admin/users/:id' },
            { method: 'GET', path: '/api/auth/*' }
        ];
        expect(isRegistered({ route: '/api/v1/admin/users/${id}?x=1', routes: registered })).toBe(
            true
        );
        expect(isRegistered({ route: '/api/v1/admin/users/1', routes: registered })).toBe(true);
        expect(isRegistered({ route: '/api/auth/session/current', routes: registered })).toBe(true);
        expect(isRegistered({ route: '/api/v1/admin/users/1/more', routes: registered })).toBe(
            false
        );
    });

    it('catches the planted web billingApi.purchaseAddon route with file and line', () => {
        const source = [
            "const PROTECTED = '/api/v1/protected';",
            'const billingApi = { purchaseAddon() {',
            '  return apiClient.postProtected({ path: `${PROTECTED}/billing/addons/purchase` });',
            '} };'
        ].join('\n');
        const calls = extractApiCalls({ file: webFile, source });
        expect(findViolations({ calls, routes })).toEqual([
            { file: webFile, line: 3, route: '/api/v1/protected/billing/addons/purchase' }
        ]);
    });

    it('catches the planted admin fetchApi to removed billing', () => {
        const source = [
            'const params = new URLSearchParams();',
            'fetchApi({ path: `/api/v1/admin/billing/notifications?${params.toString()}` });'
        ].join('\n');
        const calls = extractApiCalls({ file: adminFile, source });
        expect(findViolations({ calls, routes })).toEqual([
            { file: adminFile, line: 2, route: '/api/v1/admin/billing/notifications' }
        ]);
    });

    it('finds a stale exception when its source call disappears', () => {
        expect(
            findStaleExceptions({
                calls: [],
                known: [
                    {
                        file: webFile,
                        route: '/api/v1/public/plans',
                        owner: 'unknown',
                        reason: 'fixture'
                    }
                ]
            })
        ).toEqual([
            { file: webFile, route: '/api/v1/public/plans', owner: 'unknown', reason: 'fixture' }
        ]);
    });

    it('scans the real repository and finds no new or stale calls', () => {
        const { files, calls } = scanRepository();
        expect(files.length).toBeGreaterThan(100);
        expect(calls.length).toBeGreaterThan(100);
        expect(findViolations({ calls, routes })).toEqual([]);
        expect(findStaleExceptions({ calls })).toEqual([]);
    });
});
