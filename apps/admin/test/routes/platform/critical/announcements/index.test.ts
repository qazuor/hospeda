/**
 * @file announcements/index.test.ts
 * @description Source-based tests for the announcements list page added
 * in SPEC-156 PR-4 (T-038). Verifies the new route path, permission gate
 * (SUPER_ADMIN via MAINTENANCE_MODE_WRITE), wiring to the platform-settings
 * hooks, and the delete flow (filter + mutate + toast).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const listSrc = readFileSync(
    resolve(
        __dirname,
        '../../../../../src/routes/_authed/platform/critical/announcements/index.tsx'
    ),
    'utf8'
);

describe('platform/critical/announcements/index.tsx (T-038)', () => {
    it('registers the new route path', () => {
        expect(listSrc).toContain("createFileRoute('/_authed/platform/critical/announcements/')");
    });

    describe('permission gate', () => {
        it('requires MAINTENANCE_MODE_WRITE (SUPER_ADMIN-only)', () => {
            expect(listSrc).toContain('PermissionEnum.MAINTENANCE_MODE_WRITE');
        });

        it('redirects to /auth/forbidden when the perm is missing', () => {
            expect(listSrc).toContain("throw redirect({ to: '/auth/forbidden' })");
        });
    });

    describe('data wiring', () => {
        it('reads announcements.global via usePlatformSetting (no legacy adapter)', () => {
            expect(listSrc).toContain("key: 'announcements.global'");
            expect(listSrc).toContain('usePlatformSetting');
        });

        it('writes via useUpdatePlatformSetting on delete', () => {
            expect(listSrc).toContain('useUpdatePlatformSetting');
            expect(listSrc).toContain('mutation.mutate(next');
        });
    });

    describe('delete flow', () => {
        it('confirms with the deleteConfirm i18n string before deleting', () => {
            expect(listSrc).toContain("'admin-pages.announcements.list.deleteConfirm'");
        });

        it('filters the deleted item out of the array', () => {
            expect(listSrc).toContain('items.filter((item) => item.id !== id)');
        });

        it('toasts success + error messages around the mutation', () => {
            expect(listSrc).toContain("'admin-pages.announcements.list.deleteSuccess'");
            expect(listSrc).toContain("'admin-pages.announcements.list.deleteError'");
        });
    });

    describe('render branches', () => {
        it('shows loading state', () => {
            expect(listSrc).toContain('data-testid="announcements-loading"');
        });

        it('shows empty state when items.length === 0', () => {
            expect(listSrc).toContain('data-testid="announcements-empty"');
            expect(listSrc).toContain('items.length === 0');
        });

        it('renders the list when items are present', () => {
            expect(listSrc).toContain('data-testid="announcements-list"');
            expect(listSrc).toContain('items.length > 0');
        });

        it('exposes per-row data-announcement-id + edit + delete affordances', () => {
            expect(listSrc).toContain('data-testid="announcement-row"');
            expect(listSrc).toContain('data-announcement-id');
            expect(listSrc).toContain('data-testid="edit-announcement-link"');
            expect(listSrc).toContain('data-testid="delete-announcement-button"');
        });

        it('links the New CTA at /platform/critical/announcements/new', () => {
            expect(listSrc).toContain('data-testid="new-announcement-link"');
            expect(listSrc).toContain('to="/platform/critical/announcements/new"');
        });

        it('links the Edit button to /platform/critical/announcements/$id/edit', () => {
            expect(listSrc).toContain('to="/platform/critical/announcements/$id/edit"');
        });
    });
});
