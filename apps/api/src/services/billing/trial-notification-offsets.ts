/**
 * The nine sends of the Hospeda-owned trial email series (HOS-1012 §4).
 *
 * Three before expiry, one ON expiry, and five after — nothing at all after
 * day 60. The whole series stops the moment the person pays.
 *
 * The count reconciles a gap in the spec: §4 says "nine emails" and then lists
 * three plus five, which is eight. The ninth is the expiry mail itself,
 * `TRIAL_EXPIRED`, which §5 lists separately as "gone, must return" and the
 * Linear issue calls "el mail de vencimiento". It is the one send that reports
 * something that already happened — the listing came down — rather than warning
 * about it, so it lives at offset 0 and belongs to neither group.
 *
 * **These are deliberately constants and not settings.** Until HOS-1012 the
 * pre-expiry window was derived from `billingSettings.trialExpiryReminderDays`,
 * an admin-editable value, as the contiguous pair `[N, N-1]` plus a fixed
 * one-day block. That shape cannot express three independent offsets, and more
 * importantly it decouples each email from its own distance: the T-10 copy
 * ("is it working for you? need a hand?") is written for someone with plenty of
 * time left, and sending it one day before the listing comes down makes it read
 * as indifference. The copy and the distance have to travel together, so an
 * admin cannot desynchronise them (owner decision, 2026-09-01).
 *
 * `trialExpiryReminderDays` is therefore retired along with its admin UI — see
 * HOS-1012 T-016.
 *
 * @module services/billing/trial-notification-offsets
 */

import { NotificationType } from '@repo/notifications';
import { BILLING_EVENT_TYPES } from '@repo/service-core';

/**
 * Days BEFORE `trial_end` at which a pre-expiry email is sent, in the order the
 * subscriber experiences them.
 *
 * Each offset carries its own template and its own tone (HOS-1012 §4) — they
 * are not one template reused three times:
 *
 * - `10` — friendly, not selling. An invitation: is it working for you?
 * - `5` — still friendly, but names the risk: the listing may be unpublished.
 * - `1` — direct: if you do not pay, tomorrow it comes down.
 */
export const PRE_EXPIRY_OFFSET_DAYS = [10, 5, 1] as const;

/**
 * Days AFTER `trial_end` at which a win-back email is sent.
 *
 * Nothing is sent after day 60 — the series ends there rather than tapering,
 * so an unconverted trial stops being mailed at a defined point.
 */
export const POST_EXPIRY_OFFSET_DAYS = [1, 5, 10, 30, 60] as const;

/** A day offset before expiry at which the series sends an email. */
export type PreExpiryOffsetDay = (typeof PRE_EXPIRY_OFFSET_DAYS)[number];

/** A day offset after expiry at which the series sends a win-back email. */
export type PostExpiryOffsetDay = (typeof POST_EXPIRY_OFFSET_DAYS)[number];

/**
 * The single send that happens ON expiry day (`TRIAL_EXPIRED`), reporting that
 * the listing has come down. Offset 0: it belongs to neither the pre-expiry
 * warnings nor the post-expiry win-backs.
 */
export const EXPIRY_DAY_OFFSET = 0 as const;

/**
 * Total number of emails a trial receives across its whole lifetime when the
 * subscriber never pays: three before expiry, one on expiry day, five after.
 *
 * Deliberately written as a literal rather than as
 * `PRE.length + 1 + POST.length`: a total derived from the very arrays it is
 * meant to check moves silently whenever one of them is edited, which is
 * exactly the change a series-size assertion exists to catch.
 */
export const TOTAL_TRIAL_SERIES_EMAILS = 9;

/**
 * Which side of `trial_end` a send sits on.
 *
 * `expiry` is its own direction rather than a `post` with offset 0, because the
 * two are selected by different predicates and say different kinds of thing: a
 * win-back invites, the expiry mail reports.
 */
export type TrialSeriesDirection = 'pre' | 'expiry' | 'post';

/**
 * One send of the series: a distance, the template that belongs to it, and the
 * ledger row that proves it went out.
 */
export interface TrialSeriesSend {
    /**
     * Distance in days from `trial_end`, signed as the subscriber experiences
     * it: negative before, zero on the day, positive after.
     */
    readonly offset: number;
    /** Which side of `trial_end` this send sits on. */
    readonly direction: TrialSeriesDirection;
    /** The notification type, which selects this send's own template. */
    readonly notificationType: NotificationType;
    /**
     * The `billing_subscription_events.event_type` written when this send is
     * dispatched — the durable, per-send dedup guard.
     */
    readonly eventType: string;
}

/**
 * The nine sends, in the order a subscriber who never pays lives them.
 *
 * This table is the single place where a distance, a template and a dedup row
 * are tied together, and it exists so they cannot drift apart. The failure it
 * prevents is not hypothetical: until HOS-1012 the pre-expiry distance came
 * from an admin-editable setting while the copy was fixed in one template, so
 * an admin could move the reminder to one day out and the mail would still read
 * as though there were plenty of time.
 *
 * Nothing is sent after `+60`. The array ending is the whole mechanism — there
 * is no taper and no fallback send.
 */
export const TRIAL_SERIES_SENDS: readonly TrialSeriesSend[] = [
    {
        offset: -10,
        direction: 'pre',
        notificationType: NotificationType.TRIAL_ENDING_10D,
        eventType: BILLING_EVENT_TYPES.TRIAL_SERIES_NOTIF_PRE_10D
    },
    {
        offset: -5,
        direction: 'pre',
        notificationType: NotificationType.TRIAL_ENDING_5D,
        eventType: BILLING_EVENT_TYPES.TRIAL_SERIES_NOTIF_PRE_5D
    },
    {
        offset: -1,
        direction: 'pre',
        notificationType: NotificationType.TRIAL_ENDING_1D,
        eventType: BILLING_EVENT_TYPES.TRIAL_SERIES_NOTIF_PRE_1D
    },
    {
        offset: EXPIRY_DAY_OFFSET,
        direction: 'expiry',
        notificationType: NotificationType.TRIAL_EXPIRED,
        eventType: BILLING_EVENT_TYPES.TRIAL_SERIES_NOTIF_EXPIRY
    },
    {
        offset: 1,
        direction: 'post',
        notificationType: NotificationType.TRIAL_WIN_BACK_1D,
        eventType: BILLING_EVENT_TYPES.TRIAL_SERIES_NOTIF_POST_1D
    },
    {
        offset: 5,
        direction: 'post',
        notificationType: NotificationType.TRIAL_WIN_BACK_5D,
        eventType: BILLING_EVENT_TYPES.TRIAL_SERIES_NOTIF_POST_5D
    },
    {
        offset: 10,
        direction: 'post',
        notificationType: NotificationType.TRIAL_WIN_BACK_10D,
        eventType: BILLING_EVENT_TYPES.TRIAL_SERIES_NOTIF_POST_10D
    },
    {
        offset: 30,
        direction: 'post',
        notificationType: NotificationType.TRIAL_WIN_BACK_30D,
        eventType: BILLING_EVENT_TYPES.TRIAL_SERIES_NOTIF_POST_30D
    },
    {
        offset: 60,
        direction: 'post',
        notificationType: NotificationType.TRIAL_WIN_BACK_60D,
        eventType: BILLING_EVENT_TYPES.TRIAL_SERIES_NOTIF_POST_60D
    }
] as const;
