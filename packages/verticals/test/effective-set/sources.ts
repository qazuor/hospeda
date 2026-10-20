/**
 * Shared fixtures for the effective set's tests (HOS-1439, V3). Every source is
 * parsed with the contract's own schema, so a fixture that is not deliverable
 * fails here and not in the assertion: the fold reads real coverage sources.
 */
import { type CoverageSource, CoverageSourceSchema } from '@repo/billing-verticals-contract';
import type { FoldableSource, SourceGrant } from '../../src/effective-set/types';

const SINCE = new Date('2026-01-01T00:00:00.000Z');
const UNTIL = new Date('2026-12-31T00:00:00.000Z');

const PLAN_REFERENCE = { kind: 'PLAN_VERSION', planVersionId: 'plan-basic-v1' } as const;
const ADDON_REFERENCE = { kind: 'ADDON_VERSION', addonVersionId: 'photos-30-v1' } as const;

/** One grant on one key. */
export const grant = (args: {
    readonly key: string;
    readonly value: number;
    readonly strategy: SourceGrant['strategy'];
}): SourceGrant => ({ key: args.key, value: args.value, strategy: args.strategy });

/** A live TRIAL title of the vertical. */
export function trial(grantList: readonly SourceGrant[]): FoldableSource {
    const source: CoverageSource = CoverageSourceSchema.parse({
        type: 'TRIAL',
        reference: PLAN_REFERENCE,
        scope: 'VERTICAL',
        target: null,
        since: SINCE,
        until: UNTIL,
        charged: null,
        floor: null
    });
    return { source, grants: grantList };
}

/** A live SUBSCRIPTION title of the vertical. */
export function subscription(grantList: readonly SourceGrant[]): FoldableSource {
    const source: CoverageSource = CoverageSourceSchema.parse({
        type: 'SUBSCRIPTION',
        reference: PLAN_REFERENCE,
        scope: 'VERTICAL',
        target: null,
        since: SINCE,
        until: UNTIL,
        charged: true,
        floor: null
    });
    return { source, grants: grantList };
}

/**
 * A live ADDON complement. `USER` and `GLOBAL` are the two transport scopes the
 * discard's case covers; both carry `target: null` (contract §2).
 */
export function addon(args: {
    readonly scope: 'USER' | 'GLOBAL';
    readonly grants: readonly SourceGrant[];
}): FoldableSource {
    const source: CoverageSource = CoverageSourceSchema.parse({
        type: 'ADDON',
        reference: ADDON_REFERENCE,
        scope: args.scope,
        target: null,
        since: SINCE,
        until: UNTIL,
        charged: null,
        floor: null
    });
    return { source, grants: args.grants };
}
