/**
 * Pure assembly of the owner's listing notices and of the trial summary
 * (HOS-1492, V8a.1b; `V/19` §4 rows 2, 4, 8/9, 18, 20, 24, 30 and 31). The
 * surface reads what the core resolved and decides nothing (AC:V8a:1): every
 * notice here is a fact of the listing, its recorded transitions, its open fix
 * request and the owner's coverage, never a rule of its own.
 *
 * @module services/listing-notices/listing-notices.builder
 */

import type { CoverageResponse } from '@repo/billing-verticals-contract';
import type { ListingNoticeRow } from '@repo/db';
import {
    type ListingNotice,
    type ListingNoticesItem,
    PublicationStatusEnum,
    TrialStatusEnum,
    type TrialSummaryResponse
} from '@repo/schemas';

const DAY_MS = 86_400_000;

/** How long the «moderation lifted» notice stays visible (H13). */
export const LIFT_NOTICE_WINDOW_DAYS = 30;

/** The archive origins `PB7` brings back on its own: only an archive by `PB4` (row 18). */
const RETURNING_ARCHIVE_ORIGINS: ReadonlySet<PublicationStatusEnum> = new Set([
    PublicationStatusEnum.PUBLISHED,
    PublicationStatusEnum.UNPUBLISHED_BY_BILLING
]);

/** The statuses under which a past lift no longer describes the listing. */
const LIFT_HIDDEN_STATUSES: ReadonlySet<PublicationStatusEnum> = new Set([
    PublicationStatusEnum.MODERATED,
    PublicationStatusEnum.PURGED
]);

const TRIAL_STATUSES: ReadonlySet<string> = new Set(Object.values(TrialStatusEnum));

/** The trial row as the summary and the running flag read it. */
export interface TrialRowFacts {
    readonly status: string;
    readonly startedAt: Date | null;
    readonly endsAt: Date | null;
}

/**
 * Counts the recurring add-ons on one listing (H7): an `ADDON` source of scope
 * `LISTING` aimed at the listing whose `until` has no known date — it keeps
 * being charged until cancelled. One with a date is not recurring.
 */
export function countRecurringListingAddons(input: {
    readonly coverage: CoverageResponse;
    readonly listingId: string;
}): { readonly count: number } {
    return {
        count: input.coverage.sources.filter(
            (source) =>
                source.type === 'ADDON' &&
                source.scope === 'LISTING' &&
                source.target === input.listingId &&
                source.until === 'NO_KNOWN_DATE'
        ).length
    };
}

/** The notice of a `PURGED` listing (rows 20 and 31, H2). */
function purgedNotice(row: ListingNoticeRow): ListingNotice {
    const entered = row.enteredCurrentStatus;
    if (entered?.actorType === 'job') return { kind: 'PURGED_BY_INACTIVITY' };
    if (entered?.from === PublicationStatusEnum.MODERATED)
        return { kind: 'PURGED_FROM_MODERATION' };
    return { kind: 'PURGED' };
}

/**
 * The notice the listing's current status carries, if any. Exhaustive over
 * the six states: a seventh breaks the typecheck.
 */
export function buildStatusNotice(input: {
    readonly row: ListingNoticeRow;
    readonly covered: boolean;
}): { readonly notice: ListingNotice | null } {
    const { row } = input;
    const status = row.publicationStatus;
    switch (status) {
        case PublicationStatusEnum.PURGED:
            return { notice: purgedNotice(row) };
        case PublicationStatusEnum.ARCHIVED: {
            const origin = row.enteredCurrentStatus?.from ?? null;
            return {
                notice: {
                    kind: 'ARCHIVED',
                    deletionAnnouncedAt: row.deletionAnnouncedAt?.toISOString() ?? null,
                    returnsOnItsOwn: origin !== null && RETURNING_ARCHIVE_ORIGINS.has(origin)
                }
            };
        }
        case PublicationStatusEnum.MODERATED:
            return {
                notice: {
                    kind: 'MODERATED',
                    reason: row.enteredCurrentStatus?.reason ?? null,
                    since: row.enteredCurrentStatus?.occurredAt.toISOString() ?? null
                }
            };
        case PublicationStatusEnum.UNPUBLISHED_BY_BILLING:
            return { notice: input.covered ? { kind: 'SURPLUS' } : null };
        case PublicationStatusEnum.DRAFT:
        case PublicationStatusEnum.PUBLISHED:
            return { notice: null };
        default: {
            const exhaustive: never = status;
            throw new Error(`Unhandled publication status ${String(exhaustive)}`);
        }
    }
}

/**
 * Builds the notices of every listing of the owner (H2).
 *
 * @param input.rows - The owner's listings with their facts.
 * @param input.coverage - The owner's coverage in the vertical (one call).
 * @param input.now - The clock's instant.
 * @returns One item per listing, in the rows' order.
 */
export function buildListingNoticeItems(input: {
    readonly rows: readonly ListingNoticeRow[];
    readonly coverage: CoverageResponse;
    readonly now: Date;
}): readonly ListingNoticesItem[] {
    const windowStart = input.now.getTime() - LIFT_NOTICE_WINDOW_DAYS * DAY_MS;
    return input.rows.map((row) => {
        const notices: ListingNotice[] = [];
        const { notice } = buildStatusNotice({ row, covered: input.coverage.covered });
        if (notice) notices.push(notice);
        const fix = row.openFixRequest;
        if (fix && row.publicationStatus !== PublicationStatusEnum.PURGED) {
            notices.push({
                kind: 'FIX_REQUESTED',
                reason: fix.reason,
                suggestedDate: fix.suggestedDate,
                openedAt: fix.openedAt.toISOString(),
                ownerReportedFixedAt: fix.ownerReportedFixedAt?.toISOString() ?? null
            });
        }
        const lift = row.lastLift;
        if (
            lift &&
            lift.at.getTime() >= windowStart &&
            !LIFT_HIDDEN_STATUSES.has(row.publicationStatus)
        ) {
            notices.push({
                kind: 'MODERATION_LIFTED',
                returnedTo: lift.returnedTo,
                at: lift.at.toISOString(),
                fixRequestOpen: fix !== null
            });
        }
        return {
            listingId: row.id,
            publicationStatus: row.publicationStatus,
            recurringListingAddons: countRecurringListingAddons({
                coverage: input.coverage,
                listingId: row.id
            }).count,
            notices
        };
    });
}

/** Row 2: the trial is running when it is `TRIAL_ACTIVE` and its clock has not ended. */
export function isTrialRunning(input: {
    readonly trial: TrialRowFacts | null;
    readonly now: Date;
}): { readonly running: boolean } {
    const trial = input.trial;
    return {
        running:
            trial !== null &&
            trial.status === TrialStatusEnum.TRIAL_ACTIVE &&
            trial.endsAt !== null &&
            trial.endsAt.getTime() > input.now.getTime()
    };
}

/**
 * Row 4 (H3): the accumulated trial days and their origin. `base` is what is
 * left of the total once promo and support days are taken out.
 */
export function buildTrialSummary(input: {
    readonly trial: TrialRowFacts | null;
    readonly promoDays: number;
    readonly supportDays: number;
}): TrialSummaryResponse {
    const trial = input.trial;
    if (!trial) return { status: 'NONE' };
    if (!TRIAL_STATUSES.has(trial.status)) throw new Error(`Unknown trial status ${trial.status}`);
    const totalDays =
        trial.startedAt && trial.endsAt
            ? Math.round((trial.endsAt.getTime() - trial.startedAt.getTime()) / DAY_MS)
            : 0;
    return {
        status: trial.status as TrialStatusEnum,
        startedAt: trial.startedAt?.toISOString() ?? null,
        endsAt: trial.endsAt?.toISOString() ?? null,
        totalDays,
        origins: {
            base: totalDays - input.promoDays - input.supportDays,
            promo: input.promoDays,
            support: input.supportDays
        }
    };
}
