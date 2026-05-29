/**
 * @file platform-critical.test.ts
 * @description Source-based tests for the platform critical settings page.
 * Page location set in SPEC-156 PR-2 (T-019); data layer rewritten in
 * SPEC-156 PR-3 (T-029) to read + write through the platform_settings API
 * via `usePlatformSetting`/`useUpdatePlatformSetting`. Tests cover that
 * the localStorage source has been removed and the page is wired to the
 * `maintenance.mode` + `announcements.global` keys with the matching
 * legacy adapter for the maintenance migration.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pickActiveAnnouncement } from '../../src/routes/_authed/platform/critical/index';

const criticalSrc = readFileSync(
    resolve(__dirname, '../../src/routes/_authed/platform/critical/index.tsx'),
    'utf8'
);

describe('platform/critical/index.tsx (T-019 + T-029)', () => {
    it('registers the new route path', () => {
        expect(criticalSrc).toContain("createFileRoute('/_authed/platform/critical/')");
    });

    describe('data layer migration (T-029)', () => {
        it('no longer reads or writes localStorage for maintenance mode', () => {
            expect(criticalSrc).not.toContain('localStorage.getItem');
            expect(criticalSrc).not.toContain('localStorage.setItem');
        });

        it('reads maintenance.mode via usePlatformSetting + maintenanceMode adapter', () => {
            expect(criticalSrc).toContain("key: 'maintenance.mode'");
            expect(criticalSrc).toContain('legacyAdapters.maintenanceMode');
            expect(criticalSrc).toContain('usePlatformSetting');
        });

        it('writes maintenance.mode via useUpdatePlatformSetting', () => {
            expect(criticalSrc).toContain('useUpdatePlatformSetting');
            expect(criticalSrc).toContain('maintenanceMutation.mutate');
        });

        it('reads announcements.global via usePlatformSetting (read-only preview)', () => {
            expect(criticalSrc).toContain("key: 'announcements.global'");
        });
    });

    it('still renders the maintenance mode card', () => {
        expect(criticalSrc).toContain("t('admin-pages.systemSettings.critical.maintenanceMode')");
    });

    it('still renders the global announcements card', () => {
        expect(criticalSrc).toContain(
            "t('admin-pages.systemSettings.critical.globalAnnouncements')"
        );
    });

    it('still renders the cache management card', () => {
        expect(criticalSrc).toContain("t('admin-pages.systemSettings.critical.cacheManagement')");
    });
});

describe('pickActiveAnnouncement (T-029)', () => {
    const now = new Date('2026-06-01T12:00:00Z');

    it('returns null when the list is empty', () => {
        expect(pickActiveAnnouncement([], now)).toBeNull();
    });

    it('picks the first item with an open-ended window (no start, no end)', () => {
        const items = [
            {
                id: '11111111-1111-1111-1111-111111111111',
                text: { es: 'Mensaje activo', en: 'Active', pt: 'Ativo' },
                variant: 'info' as const,
                dismissible: true
            }
        ];
        expect(pickActiveAnnouncement(items, now)).toBe('Mensaje activo');
    });

    it('skips items whose startsAt is in the future', () => {
        const items = [
            {
                id: '22222222-2222-2222-2222-222222222222',
                text: { es: 'Próximo', en: 'Upcoming', pt: 'Próximo' },
                variant: 'info' as const,
                dismissible: true,
                startsAt: '2026-07-01T00:00:00+00:00'
            },
            {
                id: '33333333-3333-3333-3333-333333333333',
                text: { es: 'Vigente', en: 'Current', pt: 'Atual' },
                variant: 'info' as const,
                dismissible: true
            }
        ];
        expect(pickActiveAnnouncement(items, now)).toBe('Vigente');
    });

    it('skips items whose endsAt is in the past', () => {
        const items = [
            {
                id: '44444444-4444-4444-4444-444444444444',
                text: { es: 'Expirado', en: 'Expired', pt: 'Expirado' },
                variant: 'info' as const,
                dismissible: true,
                endsAt: '2026-05-01T00:00:00+00:00'
            },
            {
                id: '55555555-5555-5555-5555-555555555555',
                text: { es: 'Vigente', en: 'Current', pt: 'Atual' },
                variant: 'info' as const,
                dismissible: true
            }
        ];
        expect(pickActiveAnnouncement(items, now)).toBe('Vigente');
    });

    it('returns the es text by default (operator-facing preview)', () => {
        const items = [
            {
                id: '66666666-6666-6666-6666-666666666666',
                text: { es: 'Hola', en: 'Hello', pt: 'Olá' },
                variant: 'info' as const,
                dismissible: true
            }
        ];
        expect(pickActiveAnnouncement(items, now)).toBe('Hola');
    });
});
