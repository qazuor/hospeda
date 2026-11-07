/** HOS-1689: per-action route binding alignment for the administrative-action route-permission guard. */

import { ADMINISTRATIVE_ACTIONS } from '@repo/verticals';
import { describe, expect, it } from 'vitest';
import {
    type ActionRow,
    BOUND_ACTIONS,
    bindingsOf,
    collectDifferences,
    compareBinding,
    KNOWN_MISALIGNED
} from './administrative-action-route-permissions.guard.fixtures';

describe('TEST:1696:5 AC:1696:5 / HOS-1689 — each administrative action row agrees with its route gate', () => {
    it.each(
        BOUND_ACTIONS.filter((action) => !(action in KNOWN_MISALIGNED))
    )('c. %s matches its route gate', (action) => {
        expect(collectDifferences(action)).toEqual([]);
    });
    it.each(
        ADMINISTRATIVE_ACTIONS.filter((action) => action in KNOWN_MISALIGNED)
    )('d. %s is still misaligned — remove its KNOWN_MISALIGNED entry only once it agrees', (action) => {
        expect(collectDifferences(action).length).toBeGreaterThan(0);
    });
    it('f. sees the ACC_11 bug it was written for, with a false row, never touching the table', () => {
        const staleRow: ActionRow = { permissions: [], pendingOwnPermission: 'x' };
        const differences = bindingsOf('ACC_11')
            .map((binding) => compareBinding({ action: 'ACC_11', row: staleRow, binding }))
            .filter((difference): difference is string => difference !== null);
        expect(differences.length).toBeGreaterThan(0);
    });
});
