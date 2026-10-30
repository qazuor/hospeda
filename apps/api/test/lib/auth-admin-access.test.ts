/**
 * TEST:V5:11 — Better Auth `admin` plugin configuration and the permission
 * enum after HOS-1352 V5 (AC:V5:10, AC:V5:11; DEC-AUTH-003 points 4 and 5).
 *
 * - No plugin role carries `impersonate` or `set-role`, and neither action is a
 *   plugin statement any more.
 * - `fullAdminRole` (SUPER_ADMIN, ADMIN) grants no plugin action at all, on
 *   `user` or on `session`, exactly like `noAdminRole`.
 * - `PermissionEnum` has no `USER_IMPERSONATE` / `user.impersonate`.
 * - `auth.ts` hands the plugin THIS roles map, so the module above is the
 *   configuration that actually runs (instantiating Better Auth needs a live
 *   DB, so the wiring is asserted over the source).
 *
 * @module test/lib/auth-admin-access.test
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    adminPluginRoles,
    adminPluginStatements,
    fullAdminRole,
    noAdminRole
} from '../../src/lib/auth-admin-access';

const AUTH_SOURCE = readFileSync(join(__dirname, '../../src/lib/auth.ts'), 'utf8');

/** Every action the plugin could have offered before V5, per resource. */
const EVERY_PLUGIN_ACTION = {
    user: [
        'create',
        'list',
        'set-role',
        'ban',
        'impersonate',
        'delete',
        'set-password',
        'get',
        'update'
    ],
    session: ['list', 'revoke', 'delete']
} as const;

type PluginRole = typeof fullAdminRole;

/** Statements a role grants, flattened to `resource:action` strings. */
function grantedActions(role: PluginRole): string[] {
    const statements = role.statements as Record<string, readonly string[]>;
    return Object.entries(statements).flatMap(([resource, actions]) =>
        actions.map((action) => `${resource}:${action}`)
    );
}

describe('TEST:V5:11 — admin plugin without impersonation and with an empty fullAdminRole', () => {
    it('no plugin statement offers impersonate or set-role', () => {
        const userActions: readonly string[] = adminPluginStatements.user;
        expect(userActions).not.toContain('impersonate');
        expect(userActions).not.toContain('set-role');
    });

    it('no plugin role carries impersonate or set-role', () => {
        for (const [roleName, role] of Object.entries(adminPluginRoles)) {
            const granted = grantedActions(role);
            expect(granted, roleName).not.toContain('user:impersonate');
            expect(granted, roleName).not.toContain('user:set-role');
        }
    });

    it('fullAdminRole lists no action on user nor on session, like noAdminRole', () => {
        expect(grantedActions(fullAdminRole)).toEqual([]);
        expect(grantedActions(noAdminRole)).toEqual([]);
        expect(adminPluginRoles.SUPER_ADMIN).toBe(fullAdminRole);
        expect(adminPluginRoles.ADMIN).toBe(fullAdminRole);
    });

    it('fullAdminRole authorizes no plugin action, one by one', () => {
        for (const [resource, actions] of Object.entries(EVERY_PLUGIN_ACTION)) {
            for (const action of actions) {
                const result = fullAdminRole.authorize({ [resource]: [action] } as never);
                expect(result.success, `${resource}:${action}`).toBe(false);
            }
        }
    });

    it('PermissionEnum has no USER_IMPERSONATE', () => {
        expect(Object.keys(PermissionEnum)).not.toContain('USER_IMPERSONATE');
        expect(Object.values(PermissionEnum)).not.toContain('user.impersonate');
    });

    it('auth.ts hands the plugin this roles map and defines no inline plugin role', () => {
        expect(AUTH_SOURCE).toMatch(/admin\(\{[\s\S]*?roles: adminPluginRoles\b/);
        expect(AUTH_SOURCE).not.toMatch(/createAccessControl|newRole\(/);
        expect(AUTH_SOURCE).not.toMatch(/'impersonate'|'set-role'/);
    });
});
