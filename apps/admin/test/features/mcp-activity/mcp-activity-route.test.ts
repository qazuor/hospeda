/**
 * HOS-2349 (spec HOS-2335 §6.10, AC-C51): the admin assistant activity screen
 * is gated by MCP_ACTIVITY_VIEW, never by a role.
 *
 * - The route's `beforeLoad` redirects to /auth/forbidden without the
 *   permission, ADMIN's audit-log read included, and passes with it.
 * - The sidebar entry is hidden (`onMissing: 'hide'`) for an ADMIN-like
 *   permission set and shown for one holding MCP_ACTIVITY_VIEW.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';

type BeforeLoad = (input: { readonly context: unknown }) => void;

vi.mock('@tanstack/react-router', () => ({
    redirect: (options: { to: string }) => ({ isRedirect: true, options }),
    createFileRoute: () => (options: { beforeLoad: BeforeLoad }) => ({ options })
}));
vi.mock('@/features/mcp-activity/config/mcp-activity.config', () => ({
    McpActivityPageComponent: () => null,
    McpActivityRoute: { options: { validateSearch: () => ({}) } }
}));

const { Route } = await import('../../../src/routes/_authed/platform/ops/mcp-activity');
const { sidebars } = await import('../../../src/config/ia/sidebars');
const { isPermissionGateGranted } = await import('../../../src/lib/nav/permission-visibility');

const routeOptions = (Route as unknown as { options: { beforeLoad: BeforeLoad } }).options;
const beforeLoad = (permissions: readonly string[] | undefined) =>
    routeOptions.beforeLoad({ context: { permissions } });

/** ADMIN-like staff: admin API access and the audit-log read, but not this log. */
const ADMIN_LIKE = [
    PermissionEnum.ACCESS_API_ADMIN,
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.AUDIT_LOG_VIEW,
    PermissionEnum.SECURITY_LOG_VIEW
];
const WITH_PERMISSION = [...ADMIN_LIKE, PermissionEnum.MCP_ACTIVITY_VIEW];

describe('admin assistant activity route (AC-C51)', () => {
    it('passes with ACCESS_API_ADMIN and MCP_ACTIVITY_VIEW', () => {
        expect(() => beforeLoad(WITH_PERMISSION)).not.toThrow();
    });

    it('redirects an ADMIN without MCP_ACTIVITY_VIEW to /auth/forbidden', () => {
        expect.assertions(1);
        try {
            beforeLoad(ADMIN_LIKE);
        } catch (error) {
            expect(error).toMatchObject({ options: { to: '/auth/forbidden' } });
        }
    });

    it('redirects with no permissions at all', () => {
        expect(() => beforeLoad(undefined)).toThrow();
    });

    it('declares the permission gate and no role in the route source', () => {
        const source = readFileSync(
            join(__dirname, '../../../src/routes/_authed/platform/ops/mcp-activity.tsx'),
            'utf8'
        );
        expect(source).toContain(
            'requireAdminPermission(context, PermissionEnum.MCP_ACTIVITY_VIEW)'
        );
        expect(source).not.toMatch(/RoleEnum|SUPER_ADMIN'|'ADMIN'/);
    });
});

describe('admin assistant activity navigation', () => {
    const entry = sidebars.plataformaSidebar.items.find((item) => item.id === 'mcp-activity');

    it('exposes a hidden-when-missing sidebar link gated on MCP_ACTIVITY_VIEW', () => {
        expect(entry).toMatchObject({
            type: 'link',
            route: '/platform/ops/mcp-activity',
            permissions: ['MCP_ACTIVITY_VIEW'],
            onMissing: 'hide'
        });
    });

    it('hides the link from an ADMIN-like user and shows it with the permission', () => {
        const gate = entry?.type === 'link' ? entry.permissions : undefined;
        expect(isPermissionGateGranted({ gate, userPermissions: ADMIN_LIKE })).toBe(false);
        expect(isPermissionGateGranted({ gate, userPermissions: WITH_PERMISSION })).toBe(true);
    });
});
