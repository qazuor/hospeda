/**
 * Suppression evaluator of the email outbox (HOS-1423, AC:U2:7).
 *
 * Pure: it receives the facts the sender read and decides. No I/O, no clock.
 *
 * NUCLEO/07 §4: two classes and four causes, applied IN ORDER:
 * 1. hard bounce      → suppresses everything, transactional included;
 * 2. deleted account  → suppresses what was enqueued AFTER the deletion;
 *                       what was enqueued before goes to the address its row
 *                       captured;
 * 3. opt-out          → commercial only;
 * 4. daily cap        → commercial only, counted per recipient.
 *
 * @module services/outbox/email-outbox-suppression
 */

import { NotificationType } from '../../types/notification.types.js';

/** The two mail classes of NUCLEO/07 §4.1. */
export type OutboxEmailClass = 'transactional' | 'commercial';

/** The four suppression causes of NUCLEO/07 §4.2, in evaluation order. */
export type OutboxSuppressionCause = 'hard_bounce' | 'account_deleted' | 'opt_out' | 'daily_cap';

/**
 * Class of each outbox template. Only the post-trial win-back campaign
 * (NUCLEO/07 §4.1) is commercial. A template that is NOT listed here is
 * transactional: an unknown mail is never suppressed by opt-out or cap,
 * because silently dropping an obligatory notice is the worse failure.
 */
export const OUTBOX_TEMPLATE_CLASS: Readonly<Record<string, OutboxEmailClass>> = {
    [NotificationType.TRIAL_WIN_BACK_1D]: 'commercial',
    [NotificationType.TRIAL_WIN_BACK_5D]: 'commercial',
    [NotificationType.TRIAL_WIN_BACK_10D]: 'commercial',
    [NotificationType.TRIAL_WIN_BACK_30D]: 'commercial',
    [NotificationType.TRIAL_WIN_BACK_60D]: 'commercial'
};

/**
 * Resolves the class of an outbox template.
 *
 * @param input - The template identifier.
 * @returns The class; `transactional` when the template is not mapped.
 */
export function classifyOutboxTemplate(input: { readonly template: string }): {
    readonly emailClass: OutboxEmailClass;
} {
    const mapped = Object.hasOwn(OUTBOX_TEMPLATE_CLASS, input.template)
        ? OUTBOX_TEMPLATE_CLASS[input.template]
        : undefined;
    return { emailClass: mapped ?? 'transactional' };
}

/** Facts the sender read about one outbox row before deciding. */
export interface OutboxSuppressionFacts {
    /** Class of the row's template. */
    readonly emailClass: OutboxEmailClass;
    /** Whether the row's address has ever hard-bounced. */
    readonly hasHardBounce: boolean;
    /** `users.deleted_at` of the recipient account; `null` when live or there is no account. */
    readonly accountDeletedAt: Date | null;
    /** `email_outbox.created_at` of the row. */
    readonly enqueuedAt: Date;
    /** Whether the recipient opted out of this mail. Only read for commercial mail. */
    readonly optedOut: boolean;
    /** Commercial mails already sent to this recipient inside the cap window. */
    readonly commercialSentInWindow: number;
    /** Cap of commercial mails per recipient per window. */
    readonly dailyCap: number;
}

/** Decision of {@link evaluateOutboxSuppression}. */
export type OutboxSuppressionDecision =
    | { readonly suppressed: false }
    | {
          readonly suppressed: true;
          readonly cause: OutboxSuppressionCause;
          /**
           * `true` when the mail is transactional and will never arrive for a
           * reason a person must see (a hard bounce, NUCLEO/07 §4.2: "un
           * rebote duro sobre un correo obligatorio no es un no-envío: es un
           * evento").
           */
          readonly escalate: boolean;
      };

/**
 * Decides whether a queued mail is suppressed, applying the four causes in
 * order and by class.
 *
 * @param input - The facts of one outbox row.
 * @returns Whether it is suppressed, the first cause that applies, and whether it escalates.
 */
export function evaluateOutboxSuppression(
    input: OutboxSuppressionFacts
): OutboxSuppressionDecision {
    const isCommercial = input.emailClass === 'commercial';

    if (input.hasHardBounce) {
        return { suppressed: true, cause: 'hard_bounce', escalate: !isCommercial };
    }

    if (
        input.accountDeletedAt !== null &&
        input.enqueuedAt.getTime() > input.accountDeletedAt.getTime()
    ) {
        return { suppressed: true, cause: 'account_deleted', escalate: false };
    }

    if (isCommercial && input.optedOut) {
        return { suppressed: true, cause: 'opt_out', escalate: false };
    }

    if (isCommercial && input.commercialSentInWindow >= input.dailyCap) {
        return { suppressed: true, cause: 'daily_cap', escalate: false };
    }

    return { suppressed: false };
}
