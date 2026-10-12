/** Timing and exported controls for measured failed charge cycles (RP8, GR-3). */
export const FAKE_CYCLE_ATTEMPTS = 4;
export const FAKE_PAUSE_BEFORE_EXPIRY_MS = 90_000;

import type { FakeLedger } from './fake-ledger';
import type { StoredAuthorization, StoredCharge } from './fake-support';

/** Three retry instants at quarter points in one collection window. */
export function fakeCycleRetryInstants(args: {
    readonly createdAt: string;
    readonly expiresAt: string;
}): readonly number[] {
    const start = Date.parse(args.createdAt);
    const end = Date.parse(args.expiresAt);
    const window = end - start;
    return [1, 2, 3].map((quarter) => start + (window * quarter) / FAKE_CYCLE_ATTEMPTS);
}

/** Applies due retry attempts to their existing records and pauses expired failures. */
export function applyFakeChargeCycles(args: {
    readonly charges: Map<string, StoredCharge>;
    readonly authorizations: Map<string, StoredAuthorization>;
    readonly now: number;
    readonly ledger: FakeLedger;
    readonly updateLastAttempt: boolean;
}): void {
    for (const [chargeId, stored] of args.charges) {
        const authorization = args.authorizations.get(stored.snapshot.authorizationId);
        if (
            stored.cycleAttempts &&
            stored.cycleAttempt !== undefined &&
            stored.snapshot.status === 'rejected'
        ) {
            let attemptIndex: number = stored.cycleAttempt;
            while (
                attemptIndex <= stored.cycleAttempts.length &&
                (stored.cycleAttempts[attemptIndex - 1] ?? Infinity) <= args.now
            ) {
                const at = stored.cycleAttempts[attemptIndex - 1] ?? args.now;
                const attempt = attemptIndex + 1;
                attemptIndex = attempt;
                stored.cycleAttempt = attemptIndex;
                const approved = stored.approveOnAttempt === attempt;
                stored.snapshot = {
                    ...stored.snapshot,
                    status: approved ? 'approved' : 'rejected'
                };
                args.ledger.bump({ stored, resourceKind: 'charge', resourceId: chargeId, at });
                if (authorization && (approved || args.updateLastAttempt)) {
                    authorization.snapshot = {
                        ...authorization.snapshot,
                        lastChargedAt: new Date(at).toISOString()
                    };
                    args.ledger.bump({
                        stored: authorization,
                        resourceKind: 'authorization',
                        resourceId: stored.snapshot.authorizationId,
                        at
                    });
                }
                if (approved) break;
            }
            if (
                authorization &&
                stored.snapshot.status === 'rejected' &&
                stored.snapshot.expiresAt !== null &&
                Date.parse(stored.snapshot.expiresAt) - FAKE_PAUSE_BEFORE_EXPIRY_MS <= args.now &&
                authorization.snapshot.status === 'active'
            ) {
                authorization.snapshot = {
                    ...authorization.snapshot,
                    status: 'paused',
                    lastModifiedAt: new Date(args.now).toISOString()
                };
                args.ledger.bump({
                    stored: authorization,
                    resourceKind: 'authorization',
                    resourceId: stored.snapshot.authorizationId
                });
            }
        }
    }
}
