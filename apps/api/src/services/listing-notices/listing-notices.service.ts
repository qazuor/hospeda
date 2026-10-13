/**
 * Composition reads and the row-30 write of Mi Cuenta (HOS-1492, V8a.1b):
 *
 * - `listListingNotices` (H2): the notices of every listing of the owner in a
 *   vertical, and whether the owner's trial there is running (row 2).
 * - `readTrialSummary` (H3, row 4): the accumulated trial days and their origin.
 * - `reportFixed` (H4, row 30): the owner says they fixed what a fix request
 *   asked, under the owner's publication lock.
 *
 * The reads decide nothing (AC:V8a:1). A failing read throws: the web shows the
 * card without a notice, never an invented one.
 *
 * @module services/listing-notices/listing-notices.service
 */

import type { DrizzleClient } from '@repo/db';
import {
    domainEvent,
    getDb,
    listingModerationModel,
    listingNoticesModel,
    listingPublicationModel,
    trialRedemptions,
    trials
} from '@repo/db';
import {
    type ListingNoticesResponse,
    type ReportFixedResponse,
    ServiceErrorCode,
    type TrialSummaryResponse
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { type ListingVertical, trialMachineLockKey } from '@repo/verticals';
import { and, eq } from 'drizzle-orm';
import { getClock } from '../../utils/clock';
import { getListingAccessPorts } from '../../utils/listing-access/ports';
import {
    buildListingNoticeItems,
    buildTrialSummary,
    isTrialRunning,
    type TrialRowFacts
} from './listing-notices.builder';

/** Reads the person's trial row in a vertical, if any. */
async function readTrialRow(input: {
    readonly userId: string;
    readonly vertical: ListingVertical;
}): Promise<(TrialRowFacts & { readonly id: string }) | null> {
    const [row] = await getDb()
        .select({
            id: trials.id,
            status: trials.status,
            startedAt: trials.startedAt,
            endsAt: trials.endsAt
        })
        .from(trials)
        .where(and(eq(trials.userId, input.userId), eq(trials.vertical, input.vertical)))
        .limit(1);
    return row ?? null;
}

/**
 * H2: the notices of every listing of the actor in the vertical.
 *
 * @param input.userId - The authenticated owner.
 * @param input.vertical - The listing vertical.
 * @returns `{ trialRunning, items }`.
 * @throws When any read fails, coverage included (never an invented `covered`).
 */
export async function listListingNotices(input: {
    readonly userId: string;
    readonly vertical: ListingVertical;
}): Promise<ListingNoticesResponse> {
    const now = getClock().clock.now();
    const [rows, coverage, trial] = await Promise.all([
        listingNoticesModel.readOwnerListingNotices({
            vertical: input.vertical,
            ownerId: input.userId
        }),
        getListingAccessPorts().billing.coverage({
            userId: input.userId,
            vertical: input.vertical
        }),
        readTrialRow(input)
    ]);
    return {
        trialRunning: isTrialRunning({ trial, now }).running,
        items: [...buildListingNoticeItems({ rows, coverage, now })]
    };
}

/**
 * H3 (row 4): the trial with its total days and their origin — promo days are
 * the `canje_de_trial` redemptions, support days the `trial.extended` events of
 * that trial (action 11).
 *
 * @param input.userId - The authenticated person.
 * @param input.vertical - The vertical.
 * @returns The summary, or `{ status: 'NONE' }` without a trial row.
 */
export async function readTrialSummary(input: {
    readonly userId: string;
    readonly vertical: ListingVertical;
}): Promise<TrialSummaryResponse> {
    const trial = await readTrialRow(input);
    if (!trial) return { status: 'NONE' };
    const [redemptions, events] = await Promise.all([
        getDb()
            .select({ days: trialRedemptions.appliedDays })
            .from(trialRedemptions)
            .where(
                and(
                    eq(trialRedemptions.userId, input.userId),
                    eq(trialRedemptions.vertical, input.vertical)
                )
            ),
        getDb()
            .select({ changes: domainEvent.changes })
            .from(domainEvent)
            .where(
                and(
                    eq(domainEvent.eventType, 'trial.extended'),
                    eq(domainEvent.entityType, 'trial'),
                    eq(domainEvent.entityId, trial.id)
                )
            )
    ]);
    const promoDays = redemptions.reduce((total, row) => total + row.days, 0);
    const supportDays = events.reduce((total, event) => {
        const days = event.changes.find((change) => change.field === 'days')?.new;
        return total + (typeof days === 'number' ? days : 0);
    }, 0);
    return buildTrialSummary({ trial, promoDays, supportDays });
}

/**
 * H4 (row 30): the owner reports the open fix request as fixed. Runs under the
 * owner's publication lock (the `trial-start:` key every PB transition takes),
 * re-reads the listing locked, and writes `owner_reported_fixed_at` once. No
 * event, no close, no `inactive_since`.
 *
 * @param input.vertical - The listing vertical.
 * @param input.listingId - The listing the route already authorized.
 * @returns The reported instant (the first one on a repeat).
 * @throws ServiceError 404 when the listing is gone, 409 `NO_OPEN_FIX_REQUEST`
 * without an open request.
 */
export async function reportFixed(input: {
    readonly vertical: ListingVertical;
    readonly listingId: string;
}): Promise<ReportFixedResponse> {
    const db = getDb();
    const owner = await listingPublicationModel.readListing({
        tx: db,
        vertical: input.vertical,
        listingId: input.listingId
    });
    if (!owner) throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Listing not found');
    const at = getClock().clock.now();
    const result = await db.transaction(async (rawTx) => {
        const tx = rawTx as DrizzleClient;
        await listingPublicationModel.lock({
            tx,
            key: trialMachineLockKey({ userId: owner.ownerId, vertical: input.vertical }).key
        });
        const listing = await listingPublicationModel.readListing({
            tx,
            vertical: input.vertical,
            listingId: input.listingId
        });
        if (!listing || listing.ownerId !== owner.ownerId)
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Listing not found');
        return listingModerationModel.reportFixed({
            tx,
            vertical: input.vertical,
            listingId: input.listingId,
            at
        });
    });
    switch (result.status) {
        case 'NO_OPEN':
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'The listing has no open fix request',
                undefined,
                'NO_OPEN_FIX_REQUEST'
            );
        case 'ALREADY':
        case 'REPORTED':
            return { ownerReportedFixedAt: result.at.toISOString() };
        default: {
            const exhaustive: never = result;
            throw new Error(`Unhandled report result ${String(exhaustive)}`);
        }
    }
}
