/**
 * HOS-376 T-013 — the dual-role test user (host AND provider).
 *
 * AC-16 and AC-17 both need a single account that owns accommodations (so it
 * carries the HOST role) AND owns a `host_trades` listing. The SPEC-143 matrix
 * has no such user: every host there is only a host, and no test user owns a
 * provider listing at all. Without it, "a host who is also a provider can rate
 * OTHER providers but not their own" is untestable end-to-end.
 */
import { describe, expect, it } from 'vitest';
import {
    HOST_TRADE_OWNER_EMAIL,
    HOST_TRADE_OWNER_SLUG,
    resolveHostTradeOwnershipAction
} from '../../src/test-users/hostTradeOwnership.js';

const TARGET = 'user-uuid-dual-role';

describe('HOS-376 T-013 — host_trades ownership for the dual-role test user', () => {
    describe('constants', () => {
        it('uses a @local.test address like the rest of the matrix', () => {
            expect(HOST_TRADE_OWNER_EMAIL).toMatch(/@local\.test$/);
        });

        it('targets a listing slug that exists in the seed fixtures', () => {
            expect(HOST_TRADE_OWNER_SLUG).toBe('plomeria-litoral');
        });
    });

    describe('resolveHostTradeOwnershipAction', () => {
        it('links when the listing has no owner yet', () => {
            expect(
                resolveHostTradeOwnershipAction({
                    currentOwnerUserId: null,
                    targetUserId: TARGET
                })
            ).toBe('link');
        });

        it('skips when the listing is already owned by the target user', () => {
            // Idempotency: re-running db:seed:test-users must not rewrite a row
            // that is already in the desired state.
            expect(
                resolveHostTradeOwnershipAction({
                    currentOwnerUserId: TARGET,
                    targetUserId: TARGET
                })
            ).toBe('skip-already-linked');
        });

        it('refuses to steal a listing owned by someone else', () => {
            // The decisive case. This seed can run against a live-ish database
            // where a REAL provider has claimed this listing through the
            // HOS-278 alliance flow. Overwriting `ownerUserId` there would
            // silently transfer a real person's listing to a test account and
            // lock them out of their own ficha.
            expect(
                resolveHostTradeOwnershipAction({
                    currentOwnerUserId: 'some-real-provider-uuid',
                    targetUserId: TARGET
                })
            ).toBe('skip-owned-by-other');
        });

        it('treats an empty-string owner as unowned', () => {
            // Defensive: a blank string is not a user id, and reading it as one
            // would make the guard above compare against garbage.
            expect(
                resolveHostTradeOwnershipAction({
                    currentOwnerUserId: '',
                    targetUserId: TARGET
                })
            ).toBe('link');
        });

        it('is pure — the same inputs always yield the same action', () => {
            const input = { currentOwnerUserId: null, targetUserId: TARGET } as const;
            expect(resolveHostTradeOwnershipAction(input)).toBe(
                resolveHostTradeOwnershipAction(input)
            );
        });
    });
});
