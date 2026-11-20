/**
 * @file my-plan-types.ts
 * @description The shape `get_my_plan` returns and the `get_owner_summary`
 * `subscription` block repeats (HOS-2328, spec HOS-2335 §6.3 and §6.6).
 */

import { VerticalEnum } from '@repo/schemas';

/** Verticals `get_my_plan` answers for, in the order it lists them. */
export const MY_PLAN_VERTICALS = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.VENUE,
    VerticalEnum.EXPERIENCE,
    VerticalEnum.TOURIST,
    VerticalEnum.PARTNER
] as const;

/** A vertical `get_my_plan` answers for. */
export type MyPlanVertical = (typeof MY_PLAN_VERTICALS)[number];

/** The catalog plan of a title. Its name is the catalog's, translated when a label exists (HOS-1967). */
export interface MyPlanPlan {
    /** Stable catalog slug. */
    readonly slug: string;
    /** Owner-facing name: the `billing.plan.<slug>.name` label, else the catalog row's name. */
    readonly name: string;
    /** The catalog plan version the title is anchored to (an id; it changes when the plan's terms change). `null` when unknown. */
    readonly version: string | null;
}

/** One limit of the plan, with its owner-facing label. */
export interface MyPlanLimit {
    /** `billing.comparison.limitLabel.<key>`, else the key. */
    readonly label: string;
    /** The limit, or `unlimited`. */
    readonly value: number | 'unlimited';
}

/** What the plan includes right now: the effective set, with labels. */
export interface MyPlanIncludes {
    /** Granted entitlements as labels (`billing.entitlement.<key>`, else the key). */
    readonly entitlements: readonly string[];
    /** Limits with their values. */
    readonly limits: readonly MyPlanLimit[];
}

/** One recurring add-on the owner holds in the vertical. */
export interface MyPlanAddon {
    /** Owner-facing name (`billing.addon.<slug>.name`, else the catalog row's name). */
    readonly name: string;
    /** `ACTIVE`, or `PENDING_AUTHORIZATION` while its checkout is open. */
    readonly status: 'PENDING_AUTHORIZATION' | 'ACTIVE';
    /** When it ends; `null` when it renews with the subscription (no date is invented, AC-P2). */
    readonly endsAt: string | null;
    /** `true` when it has no end date and renews with the subscription. */
    readonly renewsWithSubscription: boolean;
    /**
     * Present (`true`) only on a listing add-on whose listing no longer exists or
     * is no longer the owner's. It may still be charged until billing cancels it.
     */
    readonly listingGone?: true;
}

/** The owner's title in one vertical: a live subscription, a permanent grant, a courtesy or a running trial. */
export interface MyPlanItem {
    /** The vertical. */
    readonly vertical: MyPlanVertical;
    /** Owner-facing vertical name (`account.subscription.mine.vertical.<vertical>`). */
    readonly verticalLabel: string;
    /** The plan; `null` only when the catalog row could not be identified. */
    readonly plan: MyPlanPlan | null;
    /**
     * The subscription status; `COURTESY` or `PERMANENT_GRANT` when that is what
     * covers the vertical (AC-C16); `TRIAL` for a running trial.
     */
    readonly status:
        | 'ACTIVE'
        | 'GRACE_PERIOD'
        | 'SUSPENDED'
        | 'CANCEL_SCHEDULED'
        | 'PAUSED'
        | 'COURTESY'
        | 'PERMANENT_GRANT'
        | 'TRIAL';
    /** The trial machine state when `status` is `TRIAL`; `null` otherwise. */
    readonly trialState: 'TRIAL_ACTIVE' | null;
    /** Owner-facing status label. */
    readonly statusLabel: string;
    /** Next automatic charge (active card subscriptions only); `null` otherwise. */
    readonly nextChargeAt: string | null;
    /** When the service ends (a cancellation already asked for); `null` otherwise. */
    readonly serviceEndsAt: string | null;
    /** When the grace period for a failed payment ends; `null` otherwise. */
    readonly graceEndsAt: string | null;
    /** Whole days left in the trial; `null` when the title is not a trial. */
    readonly trialDaysLeft: number | null;
    /**
     * When the courtesy ends (`COURTESY`); `null` for a permanent grant, which
     * never ends, and for every other status. Never invented.
     */
    readonly coverageEndsAt: string | null;
    /** What the plan includes; `null` when it could not be read right now (never invented). */
    readonly includes: MyPlanIncludes | null;
    /** Recurring add-ons held in this vertical. */
    readonly addons: readonly MyPlanAddon[];
    /** The subscription page, where any change is made. */
    readonly actionUrl: string;
    /** The add-ons page; present only when add-ons are held. */
    readonly addonsUrl?: string;
}

/** A plans page the owner can go to. */
export interface MyPlanPlansLink {
    /** The vertical the page sells. */
    readonly vertical: 'accommodation' | 'venue' | 'experience';
    /** Absolute URL. */
    readonly url: string;
}

/** Result of `get_my_plan`. */
export interface MyPlanResult {
    /**
     * One item per vertical with a live subscription, a permanent grant, a
     * courtesy or a running trial. Empty when there is none.
     */
    readonly items: readonly MyPlanItem[];
    /**
     * Add-ons the owner holds that no item shows: they belong to no single
     * vertical (a listing add-on whose listing is gone and whose product fits
     * several), or none of their verticals has a title (it lapsed). Each is
     * listed once, and only when it is in the asked scope. Present only when
     * there is one; never spread over every vertical.
     */
    readonly unattributedAddons?: readonly MyPlanAddon[];
    /** The add-ons page, present with {@link unattributedAddons}. */
    readonly addonsUrl?: string;
    /** Present only when `items` is empty: the plans pages to choose a plan from. */
    readonly plans?: readonly MyPlanPlansLink[];
}
