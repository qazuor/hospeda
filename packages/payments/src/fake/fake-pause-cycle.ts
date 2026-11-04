import type { FakeLedger } from './fake-ledger';
import type { StoredAuthorization } from './fake-support';

const capabilityPauses = new WeakSet<StoredAuthorization>();

/** Records a capability pause on the fake's private stored authorization. */
export function markCapabilityPause(stored: StoredAuthorization): void {
    capabilityPauses.add(stored);
}

/** Clears the private origin when the capability resumes. */
export function clearCapabilityPause(stored: StoredAuthorization): void {
    capabilityPauses.delete(stored);
}

/** Applies the honest automatic return only to authorizations paused by the pause capability. */
export function applyHonestPauseReturn(
    ledger: FakeLedger,
    now: number,
    liesAboutM12: boolean
): void {
    if (liesAboutM12) return;
    for (const [authorizationId, stored] of ledger.authorizations) {
        const due = stored.snapshot.nextChargeAt
            ? Date.parse(stored.snapshot.nextChargeAt)
            : Infinity;
        if (stored.snapshot.status !== 'paused' || !capabilityPauses.has(stored) || due > now)
            continue;
        stored.snapshot = {
            ...stored.snapshot,
            status: 'active',
            lastModifiedAt: new Date(due).toISOString()
        };
        capabilityPauses.delete(stored);
        ledger.bump({
            stored,
            resourceKind: 'authorization',
            resourceId: authorizationId,
            at: due
        });
    }
}

/** Applies an explicit resume's calendar rule and clears its private pause origin. */
export function applyExplicitResume(
    stored: StoredAuthorization,
    now: number,
    enabled: boolean
): void {
    applyResumeCalendar({ stored, now, enabled });
    clearCapabilityPause(stored);
}

/** Advances RP10's provider calendar without creating charges or changing lastChargedAt. */
export function applyResumeCalendar(args: {
    readonly stored: StoredAuthorization;
    readonly now: number;
    readonly enabled: boolean;
}): void {
    if (!args.enabled || !args.stored.snapshot.nextChargeAt) return;
    const next = new Date(args.stored.snapshot.nextChargeAt);
    while (next.getTime() <= args.now) {
        next.setUTCMonth(next.getUTCMonth() + args.stored.snapshot.cadence.everyMonths);
    }
    args.stored.snapshot = { ...args.stored.snapshot, nextChargeAt: next.toISOString() };
}
