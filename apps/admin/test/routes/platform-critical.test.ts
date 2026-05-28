/**
 * @file platform-critical.test.ts
 * @description Source-based tests for the platform critical settings page
 * relocated from /settings/critical to /platform/critical as part of
 * SPEC-156 PR-2 (T-019). The localStorage data layer is preserved
 * verbatim; the migration to the platform_settings API is deferred to
 * PR-3 (T-029).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const criticalSrc = readFileSync(
    resolve(__dirname, '../../src/routes/_authed/platform/critical/index.tsx'),
    'utf8'
);

describe('platform/critical/index.tsx (T-019)', () => {
    it('registers the new route path', () => {
        expect(criticalSrc).toContain("createFileRoute('/_authed/platform/critical/')");
    });

    it('still reads + writes maintenance flag via localStorage', () => {
        expect(criticalSrc).toContain('localStorage.getItem(MAINTENANCE_KEY)');
        expect(criticalSrc).toContain('localStorage.setItem(MAINTENANCE_KEY');
    });

    it('still reads the global announcement from localStorage', () => {
        expect(criticalSrc).toContain('localStorage.getItem(ANNOUNCEMENT_KEY)');
    });

    it('renders the maintenance mode card', () => {
        expect(criticalSrc).toContain("t('admin-pages.systemSettings.critical.maintenanceMode')");
    });

    it('renders the global announcements card', () => {
        expect(criticalSrc).toContain(
            "t('admin-pages.systemSettings.critical.globalAnnouncements')"
        );
    });

    it('renders the cache management card', () => {
        expect(criticalSrc).toContain("t('admin-pages.systemSettings.critical.cacheManagement')");
    });
});
