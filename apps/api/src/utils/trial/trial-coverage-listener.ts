/**
 * The trial machine's consumer of the coverage-changed notice (contract §3,
 * the fourth consumer; T2, T5 and T8; HOS-1533, Coord-99).
 *
 * The notice is not believed (contract §3, D-7): this listener only uses the
 * `(userId, vertical)` pair and the `TRIAL` filter. Whether a title converts —
 * a live `TITLE` source that is not the trial and, when it is a
 * `SUBSCRIPTION`, carries `charged: true` (DEC-TRIAL-010) — is decided by
 * `convertTrialOnTitle` / `consumeTrialOnFirstPayment`, which re-read
 * `coverage()` inside their advisory lock.
 *
 * The daily coverage reconciler does NOT run the trial machine (DEC-ARCH-009
 * 📌2): a lost first-payment notice leaves T2 waiting for T3.
 */
import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import { eq, getDb, users } from '@repo/db';
import { computeTrialEmailPseudonym } from '@repo/service-core';
import { consumeTrialOnFirstPayment, convertTrialOnTitle } from '@repo/verticals';
import { emitTrialAnalyticsFact } from '../analytics/analytics-facts';
import { getClock } from '../clock';
import { getListingAccessPorts } from '../listing-access/ports';
import { apiLogger } from '../logger';
import { getTrialMachinePorts } from './trial-machine-ports';

let unsubscribe: (() => void) | undefined;

/**
 * Runs T2/T5 (convert an active or expired trial) or, when the user has no
 * trial row in that vertical, T8 (consume it on the first payment) for one
 * notice. Never throws: a failure is logged and the notice is not retried.
 */
async function convertOrConsumeTrial(event: CoverageChangedEvent): Promise<void> {
    // The trial machine emits its own `TRIAL` notices; reacting would loop with no effect.
    if (event.sourceType === 'TRIAL') return;
    const { userId, vertical } = event;
    try {
        const { unitOfWork, afterCommit } = getTrialMachinePorts();
        const { billing } = getListingAccessPorts();
        const conversion = await convertTrialOnTitle({ unitOfWork, afterCommit, billing, event });
        if (conversion.converted)
            emitTrialAnalyticsFact({
                kind: 'TRIAL_CONVERTED',
                userId,
                vertical,
                actorKind: 'SYSTEM',
                trialId: `${userId}:${vertical}`,
                transition: conversion.transition,
                trialStateBefore: conversion.transition === 'T2' ? 'ACTIVE' : 'EXPIRED',
                occurredAt: getClock().clock.now()
            });
        if (conversion.converted || conversion.reason !== 'NO_TRIAL_ROW') return;
        const [owner] = await getDb()
            .select({ email: users.email })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
        const pseudonym = computeTrialEmailPseudonym({ email: owner?.email ?? '' });
        if (!pseudonym.ok) {
            apiLogger.warn(
                { userId, vertical },
                'Trial first-payment consumption skipped: no valid owner email'
            );
            return;
        }
        const consumed = await consumeTrialOnFirstPayment({
            unitOfWork,
            afterCommit,
            billing,
            event,
            emailPseudonym: pseudonym.pseudonym
        });
        if (consumed.consumed)
            emitTrialAnalyticsFact({
                kind: 'TRIAL_CONVERTED',
                userId,
                vertical,
                actorKind: 'SYSTEM',
                trialId: `${userId}:${vertical}`,
                transition: 'T8',
                trialStateBefore: 'NONE',
                occurredAt: getClock().clock.now()
            });
    } catch (error) {
        apiLogger.error(
            { error, userId, vertical, sourceType: event.sourceType, change: event.change },
            'Trial coverage conversion failed'
        );
    }
}

/**
 * Registers the process-wide trial consumer of the coverage-changed notice
 * once; the returned closure tears it down. The listener returns its promise,
 * so the registry waits for the conversion before `emitCoverageChanged`
 * resolves.
 *
 * @returns The unsubscribe closure
 */
export function subscribeTrialCoverageConversion(): () => void {
    if (unsubscribe) return () => unsubscribe?.();
    unsubscribe = getListingAccessPorts().billing.onCoverageChanged(convertOrConsumeTrial);
    return () => {
        unsubscribe?.();
        unsubscribe = undefined;
    };
}
