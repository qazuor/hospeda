/**
 * The benefit-usage transitions with their side effects, in ONE place (HOS-2332).
 *
 * `POST /protected/host-trades/usages/{id}/confirm|reject|reject/undo` and the
 * assistant tools (`confirm_benefit_usage`, `reject_benefit_usage`,
 * `undo_benefit_rejection`) both call these. The service owns the transition;
 * the email to the declarant lives here, in `apps/api`, because the transport
 * does (`host-trade-notifications.ts`). Keeping the call and its email together
 * is what stops a caller that skips the HTTP layer from silently skipping the
 * email (HOS-2335 §5.0 C-1, the HOS-2323 lesson).
 *
 * Role-blind, like the routes: the service decides from the row's `declaredBy`
 * who may answer, so nothing here asks which side the caller is on.
 *
 * Every email is fire-and-forget: the row is already written, so a transport
 * outage must never turn a recorded answer into a failed call.
 *
 * @module lib/host-trade-usage-transitions
 */

import type { HostTradeBenefitUsage } from '@repo/schemas';
import { type Actor, HostTradeUsageService, type ServiceOutput } from '@repo/service-core';
import { apiLogger } from '../utils/logger';
import { notifyUsageConfirmed, notifyUsageRejected } from './host-trade-notifications';

const usageService = new HostTradeUsageService({ logger: apiLogger });

/** What every transition answers: the row in its new state. */
export type BenefitUsageTransitionResult = ServiceOutput<{ usage: HostTradeBenefitUsage }>;

/** Arguments shared by the three transitions. RO-RO. */
export interface BenefitUsageTransitionArgs {
    /** The caller. Must be the counterpart (or, for the undo, the rejecter). */
    readonly actor: Actor;
    /** The usage being answered. */
    readonly usageId: string;
}

/**
 * Confirms a pending usage, then tells the declarant (and invites the review
 * when the declarant is the host).
 *
 * @param args - The actor and the usage id
 * @returns The confirmed usage, or the service's refusal (NOT_FOUND for anyone
 *   but the counterpart, the declarant included)
 */
export async function confirmBenefitUsage({
    actor,
    usageId
}: BenefitUsageTransitionArgs): Promise<BenefitUsageTransitionResult> {
    const result = await usageService.confirmUsage({ usageId }, actor);
    if (result.data?.usage) {
        void notifyUsageConfirmed(result.data.usage);
    }
    return result;
}

/**
 * Rejects a pending usage, then tells the declarant, with the note when there
 * is one. A rejection blocks that side from re-declaring on the pair, so the
 * declarant cannot be left to infer it from a row that quietly stopped counting.
 *
 * @param args - The actor, the usage id and the optional note
 * @returns The rejected usage, or the service's refusal
 */
export async function rejectBenefitUsage({
    actor,
    usageId,
    note
}: BenefitUsageTransitionArgs & {
    /** Optional on purpose: rejecting must stay cheap (HOS-376 §6.5). */
    readonly note?: string;
}): Promise<BenefitUsageTransitionResult> {
    const result = await usageService.rejectUsage({ usageId, note }, actor);
    if (result.data?.usage) {
        void notifyUsageRejected(result.data.usage, note);
    }
    return result;
}

/**
 * Reverts a rejection, back to PENDING. Only the account that rejected may.
 * Sends nothing, exactly like the route always has.
 *
 * @param args - The actor and the usage id
 * @returns The usage back in PENDING, or the service's refusal
 */
export async function undoBenefitUsageRejection({
    actor,
    usageId
}: BenefitUsageTransitionArgs): Promise<BenefitUsageTransitionResult> {
    return usageService.undoRejection({ usageId }, actor);
}
