/** HOS-1689: catalog coverage and unbound rows for the administrative-action route-permission guard. */

import { ADMINISTRATIVE_ACTIONS } from '@repo/verticals';
import { expect, it } from 'vitest';
import {
    BOUND_ACTIONS,
    bindingsOf,
    KNOWN_MISALIGNED,
    ROUTE_BINDINGS,
    UNBOUND_ROWS
} from './administrative-action-route-permissions.guard.fixtures';

it('a. covers exactly the 25 catalog actions, in order', () => {
    expect(Object.keys(ROUTE_BINDINGS)).toEqual(ADMINISTRATIVE_ACTIONS);
    expect(Object.keys(ROUTE_BINDINGS)).toHaveLength(25);
});
it('b. checks exactly 56 bindings across 20 bound rows', () => {
    expect(BOUND_ACTIONS).toHaveLength(20);
    const total = BOUND_ACTIONS.reduce((count, action) => count + bindingsOf({ action }).length, 0);
    expect(total).toBe(56);
});
it('e. every unbound row names a reason and is not silently known-misaligned', () => {
    expect(UNBOUND_ROWS.length).toBeGreaterThan(0);
    for (const { action, reason } of UNBOUND_ROWS) {
        expect(reason.trim().length).toBeGreaterThan(0);
        expect(action in KNOWN_MISALIGNED).toBe(false);
    }
});
