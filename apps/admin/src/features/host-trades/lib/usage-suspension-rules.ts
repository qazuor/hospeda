/**
 * @file usage-suspension-rules.ts
 * @description When the usage audit may offer to suspend a provider
 * (HOS-376 T-056).
 *
 * A pure module rather than conditions inside the table, because every rule
 * here is an ABSENCE — a button that must not appear. Asserted against the
 * rendered output, "the rule suppressed it" and "the branch was never reached"
 * are the same empty cell.
 */

/** What the table knows about the provider named on a usage row. */
export interface UsageRowProvider {
    /** The provider's id, always present — it is the row's own foreign key. */
    readonly hostTradeId: string;
    /** The resolved display name, or `null` when the API could not name it. */
    readonly providerName: string | null;
}

/** Why the suspend action is not on offer for a row. */
export type SuspendUnavailableReason = 'unresolved-provider' | 'already-suspended';

/** Whether a row may offer to suspend, and under what name. */
export type SuspendAvailability =
    | { readonly allowed: true; readonly providerName: string }
    | { readonly allowed: false; readonly reason: SuspendUnavailableReason };

/**
 * Decides whether a usage row may offer to suspend its provider.
 *
 * Two refusals, for different reasons:
 *
 *  - **`unresolved-provider`** — the row could not be given a name. Suspending
 *    takes away a provider's ability to record work at all; offering that
 *    against a uuid asks an admin to punish someone he cannot see. The row
 *    still belongs in the audit, it just carries no action.
 *  - **`already-suspended`** — re-suspending overwrites the standing reason and
 *    the admin id on it, which would quietly erase the distinction between an
 *    automatic threshold suspension and a human's decision.
 *
 * The set is the suspension list read by the same screen, and it is allowed
 * to be INCOMPLETE — empty while that request is in flight, empty if it
 * failed, and truncated to one page besides. That only ever suppresses too
 * FEW actions, never too many, which is the safe direction: the server refuses
 * what it must, whereas a screen that hid its only write whenever a sibling
 * request failed would leave the admin with nothing to do about what he is
 * looking at.
 *
 * @param input.row - The provider as the usage row carries it.
 * @param input.suspendedProviderIds - Ids currently known to be suspended.
 * @returns Whether to offer the action, with the name to act under or the reason not to.
 */
export function resolveSuspendAvailability(input: {
    readonly row: UsageRowProvider;
    readonly suspendedProviderIds: ReadonlySet<string>;
}): SuspendAvailability {
    const { row, suspendedProviderIds } = input;

    if (!row.providerName) {
        return { allowed: false, reason: 'unresolved-provider' };
    }

    if (suspendedProviderIds.has(row.hostTradeId)) {
        return { allowed: false, reason: 'already-suspended' };
    }

    return { allowed: true, providerName: row.providerName };
}

/**
 * Whether a typed suspension reason is acceptable to send.
 *
 * Whitespace does NOT count. A reason of three spaces satisfies "non-empty"
 * everywhere except where it matters: it is stored on the row and shown to the
 * provider who asks why he was suspended, and a blank one reads as a reason
 * that was given and lost.
 *
 * @param reason - The raw text from the dialog.
 * @returns `true` when the reason carries at least one non-space character.
 */
export function isSuspensionReasonAcceptable(reason: string): boolean {
    return reason.trim().length > 0;
}
