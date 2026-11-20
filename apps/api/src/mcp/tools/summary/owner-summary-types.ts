/**
 * @file owner-summary-types.ts
 * @description The result shape of `get_owner_summary` (HOS-2331, spec
 * HOS-2335 §6.6), apart from the modules that fill it so each one imports only
 * the types it needs.
 */

import { PublicationStatusEnum } from '@repo/schemas';
import type { ListingToolVertical } from '../listing/listing-services';
import type { MyPlanAddon, MyPlanItem, MyPlanVertical } from '../plan/my-plan-types';

/** The views periods the summary offers: the two the portal's owner-wide stats offer. */
export const OWNER_SUMMARY_PERIODS = ['7d', '30d'] as const;

/** One of {@link OWNER_SUMMARY_PERIODS}. */
export type OwnerSummaryPeriod = (typeof OWNER_SUMMARY_PERIODS)[number];

/** Days in each period. */
export const OWNER_SUMMARY_PERIOD_DAYS: Readonly<Record<OwnerSummaryPeriod, number>> = {
    '7d': 7,
    '30d': 30
};

/** A publication state the summary counts: every state but the final `PURGED`. */
export type OwnerSummaryStatus = Exclude<PublicationStatusEnum, PublicationStatusEnum.PURGED>;

/** Whether a publication state is one the summary counts. */
export function isOwnerSummaryStatus(status: string): status is OwnerSummaryStatus {
    return status !== PublicationStatusEnum.PURGED && PUBLICATION_STATUSES.has(status);
}

const PUBLICATION_STATUSES: ReadonlySet<string> = new Set<string>(
    Object.values(PublicationStatusEnum)
);

/**
 * The publication states the summary counts, in the enum's order: derived from
 * `PublicationStatusEnum` minus `PURGED`, so a new state is counted without
 * touching this file.
 */
export const OWNER_SUMMARY_STATUSES: readonly OwnerSummaryStatus[] =
    Object.values(PublicationStatusEnum).filter(isOwnerSummaryStatus);

/** Listing counts of one vertical. */
export interface VerticalListingCounts {
    /** Listings in the counted states (purged ones are not counted). */
    readonly total: number;
    /** Listings per publication state. */
    readonly byStatus: Readonly<Record<OwnerSummaryStatus, number>>;
    /**
     * Present (`true`) when the owner has more listings in this vertical than
     * one read covers, so the counts are partial. Tell the user.
     */
    readonly partial?: true;
}

/** The kinds of "needs your attention" items. */
export type AttentionKind =
    | 'unanswered_inquiries'
    | 'pending_benefit_usages'
    | 'open_fix_request'
    | 'incomplete'
    | 'missing_photos';

/** The listing an attention item is about. */
export interface AttentionListing {
    /** Listing id (the `id` input of `get_listing`). */
    readonly id: string;
    /** Its vertical. */
    readonly vertical: ListingToolVertical;
    /** Its name (the owner's own text). */
    readonly name: string;
}

/** One thing that needs the owner's attention, with the portal page that resolves it. */
export interface AttentionItem {
    /** What needs attention. */
    readonly kind: AttentionKind;
    /** The listing it is about; absent for owner-wide items (inquiries, usages). */
    readonly listing?: AttentionListing;
    /** How many (unanswered inquiries, pending usages). */
    readonly count?: number;
    /** For pending usages: `host` (usages a provider declared on you) or `provider` (usages hosts declared on your listing). */
    readonly side?: 'host' | 'provider';
    /** For `incomplete`: the unmet publish requirements, in the order the rules report them. */
    readonly missing?: readonly string[];
    /** For `open_fix_request`: `true` when the owner already reported it fixed and it awaits Hospeda's review. */
    readonly reportedFixed?: boolean;
    /** The portal page where the owner resolves it. */
    readonly actionUrl: string;
}

/** A portal link. */
export interface SummaryAction {
    /** Absolute portal URL. */
    readonly url: string;
    /** Spanish label. */
    readonly label: string;
}

/** The metrics block of a vertical whose plan has no basic stats (owner decision D-9). */
export interface OmittedMetrics {
    /** Why the metrics are not shown. */
    readonly omitted: 'NO_STATS_ENTITLEMENT';
    /** Spanish note: which plans include them. */
    readonly note: string;
    /** The plans page of the vertical. */
    readonly action: SummaryAction;
}

/** Inquiries over ALL the owner's accommodations. */
export interface SummaryInquiries {
    /** Always `all_my_accommodations`: never present these as one listing's. */
    readonly scope: 'all_my_accommodations';
    /** Inquiries per calendar month, the current one (so far) and the previous one. */
    readonly byMonth: readonly { readonly month: string; readonly count: number }[];
    /** Reply rate in percent (0 to 100), all time. */
    readonly responseRatePercent: number;
    /** Average minutes to the first reply, all time; `null` while none was answered. */
    readonly averageResponseMinutes: number | null;
}

/** The metrics of one vertical, over all the owner's listings in it. */
export interface VerticalMetrics {
    /** The period `views` and `newReviews` cover. */
    readonly period: OwnerSummaryPeriod;
    /** Visits in the period, over all the owner's listings of the vertical. */
    readonly views?: number;
    /** Reviews written in the period, in every moderation state. */
    readonly newReviews: {
        readonly total: number;
        readonly byModerationState: Readonly<Record<'APPROVED' | 'PENDING' | 'REJECTED', number>>;
    };
    /** Accommodation only: inquiries and reply speed. Omitted when the owner may not read inquiries. */
    readonly inquiries?: SummaryInquiries;
    /** Accommodation only: conversations with activity the owner has not answered (the panel's badge count). */
    readonly unansweredInquiries?: number;
    /**
     * Accommodation only, advanced stats: live bookmarks summed over the owner's
     * accommodations. A user who saved two of them counts twice; it is not a
     * count of distinct users.
     */
    readonly favorites?: number;
    /**
     * Present (`true`) when the vertical has more listings than one read covers.
     * Then `newReviews` and `favorites` cover only the listings read, while
     * `views`, `inquiries` and `unansweredInquiries` cover all of them. Tell the
     * user the figures are partial.
     */
    readonly partial?: true;
    /** Metrics left out and why. Absent when nothing was left out. */
    readonly omitted?: Readonly<Record<string, 'not_in_plan' | 'not_permitted'>>;
}

/** Result of `get_owner_summary`. */
export interface OwnerSummary {
    /** Listing counts per vertical (all three verticals, zeros included). */
    readonly listings: Readonly<Record<ListingToolVertical, VerticalListingCounts>>;
    /** Metrics per vertical the owner has listings in; a vertical without the plan's stats carries the omission note. */
    readonly metrics: Readonly<
        Partial<Record<ListingToolVertical, VerticalMetrics | OmittedMetrics>>
    >;
    /** What needs the owner's attention, most urgent first, at most 10. */
    readonly attention: readonly AttentionItem[];
    /** Attention items left out of `attention` (the cap, or the response budget). */
    readonly more: number;
    /**
     * Per vertical with a live subscription, a permanent grant, a courtesy or a
     * running trial, the `get_my_plan` item (HOS-2328, AC-C33). Absent without `BILLING_VIEW_OWN`
     * or when the plan could not be read (then named in {@link omitted}). Over
     * the response budget its `includes` give way first, each replaced by
     * {@link SummaryIncludesOmitted}.
     */
    readonly subscription?: Readonly<Partial<Record<MyPlanVertical, SummaryPlanItem>>>;
    /** `get_my_plan`'s add-ons that belong to no vertical (HOS-2328 M1). Absent when none. */
    readonly unattributedAddons?: readonly MyPlanAddon[];
    /**
     * Summary blocks left out and why (today only `subscription`). Absent when
     * nothing was left out. Not the `omitted` of a metrics entry, which is
     * about that vertical's statistics.
     */
    readonly omitted?: Readonly<{ readonly subscription?: 'unavailable' }>;
}

/** What replaces a plan's `includes` in the summary when the response budget needs the room. */
export interface SummaryIncludesOmitted {
    /** Why the includes are not here. */
    readonly omitted: 'over_budget';
    /** Model-facing hint: where to read them. */
    readonly hint: string;
}

/** A `get_my_plan` item as the summary carries it: whole, or with its includes trimmed. */
export type SummaryPlanItem =
    | MyPlanItem
    | (Omit<MyPlanItem, 'includes'> & { readonly includes: SummaryIncludesOmitted });
