/**
 * Regression test: HOS-708 — `createBillingAdapter` must never silently
 * default `livemode` to `true`.
 *
 * Background: the QZPay storage adapter previously defaulted a missing
 * `livemode` config to `true` ("production"). Any call site that forgot to
 * pass it explicitly would silently write live-classified billing rows even
 * in sandbox/staging. This test locks in the fix: `livemode` is required at
 * the type level, and a caller that reaches the function at runtime without
 * a boolean (e.g. through `as any`, a plain-JS caller, or a stale build)
 * gets a loud, immediate error instead of a silent misclassification.
 *
 * @module test/billing/drizzle-adapter.livemode
 */

import { describe, expect, it } from 'vitest';
import { createBillingAdapter, type QZPayAdapterConfig } from '../../src/billing/drizzle-adapter';
import type { DrizzleClient } from '../../src/types';

// A minimal stand-in for a Drizzle client. `createBillingAdapter` only
// stores this reference at construction time (no query is issued until a
// storage method is called), so an empty object is sufficient here.
const fakeDb = {} as unknown as DrizzleClient;

describe('createBillingAdapter — livemode is required (HOS-708)', () => {
    it('throws when livemode is omitted, instead of silently defaulting to true', () => {
        // Simulates a caller that bypasses the TS type (e.g. `as any`, a
        // plain-JS consumer, or a stale build compiled before the type
        // became required) and reaches the runtime function without
        // `livemode`.
        const configMissingLivemode = {} as QZPayAdapterConfig;

        expect(() => createBillingAdapter(fakeDb, configMissingLivemode)).toThrow(
            /livemode.*required/i
        );
    });

    it('throws when livemode is not a boolean (e.g. undefined passed explicitly)', () => {
        const configWithUndefinedLivemode = {
            livemode: undefined
        } as unknown as QZPayAdapterConfig;

        expect(() => createBillingAdapter(fakeDb, configWithUndefinedLivemode)).toThrow(
            /livemode.*required/i
        );
    });

    it('does not throw when livemode is explicitly false (sandbox/staging)', () => {
        expect(() => createBillingAdapter(fakeDb, { livemode: false })).not.toThrow();
    });

    it('does not throw when livemode is explicitly true (production)', () => {
        expect(() => createBillingAdapter(fakeDb, { livemode: true })).not.toThrow();
    });
});
