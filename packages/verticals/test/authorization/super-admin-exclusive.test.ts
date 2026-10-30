import {
    CONCESSION_ACTION_KEYS,
    SUPER_ADMIN_EXCLUSIVE_PERMISSIONS,
    SUPER_ADMIN_ONLY_ACTION_KEYS
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    ADMINISTRATIVE_ACTION_PERMISSIONS,
    ADMINISTRATIVE_ACTIONS
} from '../../src/authorization/administrative-actions';

const actionKeys = [...SUPER_ADMIN_ONLY_ACTION_KEYS, ...CONCESSION_ACTION_KEYS];
type ActionKey = (typeof actionKeys)[number];
type ActionRows = Record<ActionKey, { readonly permissions: readonly string[] }>;

function findMissingExclusivePermissions(rows: ActionRows): string[] {
    const exclusive = new Set<string>(SUPER_ADMIN_EXCLUSIVE_PERMISSIONS);
    return actionKeys.flatMap((action) =>
        rows[action].permissions
            .filter((permission) => !exclusive.has(permission))
            .map(
                (permission) =>
                    `${action}: ${permission} — sumalo a SUPER_ADMIN_EXCLUSIVE_PERMISSIONS`
            )
    );
}

describe('SUPER_ADMIN-exclusive permission/action cross-check', () => {
    it('requires every permission on the nine owned action rows in the exclusive list', () => {
        const failures = findMissingExclusivePermissions(ADMINISTRATIVE_ACTION_PERMISSIONS);
        expect(failures).toEqual([]);
    });

    it('requires every exclusive permission to belong to one of the nine rows', () => {
        const rowPermissions = new Set(
            actionKeys.flatMap((action) => ADMINISTRATIVE_ACTION_PERMISSIONS[action].permissions)
        );
        for (const permission of SUPER_ADMIN_EXCLUSIVE_PERMISSIONS) {
            expect(
                rowPermissions.has(permission),
                `${permission} must belong to a listed action`
            ).toBe(true);
        }
    });

    it('requires all nine keys to exist in the administrative action catalog', () => {
        for (const action of actionKeys) expect(ADMINISTRATIVE_ACTIONS).toContain(action);
    });

    it('detects a future row permission missing from the exclusive list', () => {
        const changedRows = {
            ...ADMINISTRATIVE_ACTION_PERMISSIONS,
            ACC_19: {
                ...ADMINISTRATIVE_ACTION_PERMISSIONS.ACC_19,
                permissions: ['ordinary.permission']
            }
        } as unknown as ActionRows;
        expect(findMissingExclusivePermissions(changedRows)).toEqual([
            'ACC_19: ordinary.permission — sumalo a SUPER_ADMIN_EXCLUSIVE_PERMISSIONS'
        ]);
    });
});
