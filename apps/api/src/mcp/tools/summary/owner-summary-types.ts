/**
 * @file owner-summary-types.ts
 * @description The result shape of `get_owner_summary` (HOS-2331, spec
 * HOS-2335 §6.6), apart from the modules that fill it so each one imports only
 * the types it needs.
 */

import type { ListingToolVertical } from '../listing/listing-services';

/** The views periods the summary offers: the two the portal's owner-wide stats offer. */
export const OWNER_SUMMARY_PERIODS = ['7d', '30d'] as const;

/** One of {@link OWNER_SUMMARY_PERIODS}. */
export type OwnerSummaryPeriod = (typeof OWNER_SUMMARY_PERIODS)[number];

/** Days in each period. */
export const OWNER_SUMMARY_PERIOD_DAYS: Readonly<Record<OwnerSummaryPeriod, number>> = {
    '7d': 7,
    '30d': 30
};

/** The publication states the summary counts. `PURGED` is final and left out. */
export const OWNER_SUMMARY_STATUSES = [
    'DRAFT',
    'PUBLISHED',
    'UNPUBLISHED_BY_BILLING',
    'ARCHIVED',
    'MODERATED'
] as const;

/** One of {@link OWNER_SUMMARY_STATUSES}. */
export type OwnerSummaryStatus = (typeof OWNER_SUMMARY_STATUSES)[number];

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
    /** Accommodation only, advanced stats: users who currently saved any of the owner's accommodations. */
    readonly favorites?: number;
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
    readonly moreAttention: number;
}
