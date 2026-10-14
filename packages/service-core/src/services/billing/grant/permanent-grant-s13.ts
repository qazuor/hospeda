/**
 * Local half of TRANS:B:S13 (DEC-GRANT-001, DEC-GRANT-013, B7:26): cancel live
 * principals, release S19 and run A5 in one transaction. No S18, coverage loss or
 * provider decision here; HOS-1582 corrida 3 adds the provider half in this file.
 */
import {
    and,
    type DrizzleClient,
    eq,
    inArray,
    isNull,
    LIVE_SUBSCRIPTION_STATUSES,
    permanentGrants,
    providerLinks,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { ServiceErrorCode, VerticalEnumSchema } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import type { CancelledAddon } from '../addon/addon-instance-a5.js';
import { runOrphanhood } from '../addon/addon-instance-a5.js';
import type { AddonOrphanhoodPorts } from '../addon/addon-orphanhood-ports.js';
import type { CoverageNotices } from '../payment/payment-ports.js';
import { permanentGrantRetentionRelease } from '../subscription/succession-permanent-grant.js';
import { closeDeferredCourtesyBalances } from './permanent-grant-courtesy.js';

const logger = createLogger('permanent-grant-s13');
type LiveSubscriptionStatus = (typeof LIVE_SUBSCRIPTION_STATUSES)[number];
const CLOSES_OPEN_PAUSE: Readonly<Record<LiveSubscriptionStatus, boolean>> = {
    PENDING_AUTHORIZATION: false,
    ACTIVE: false,
    GRACE_PERIOD: false,
    PAUSED: true,
    SUSPENDED: false,
    CANCEL_SCHEDULED: false
};

/** Locked row shape shared with corrida 3's provider cancellation. */
export interface S13Row {
    readonly subscriptionId: string;
    readonly userId: string;
    readonly vertical: string;
    readonly origin: LiveSubscriptionStatus;
    readonly authorizationId: string | null;
    readonly cardPayer: boolean;
}
type S13Result = {
    readonly cancelled: readonly S13Row[];
    readonly releasedRetentionIds: readonly string[];
    readonly closedCourtesyIds: readonly string[];
    readonly orphanedAddons: readonly CancelledAddon[];
};
type CoverageNotice = {
    readonly vertical: string;
    readonly sourceType: 'GRANT' | 'SUBSCRIPTION';
    readonly change: 'ADDED' | 'REMOVED';
};
function isLiveStatus(status: string): status is LiveSubscriptionStatus {
    return LIVE_SUBSCRIPTION_STATUSES.some((candidate) => candidate === status);
}

async function readS13Rows(input: {
    readonly tx: DrizzleClient;
    readonly beneficiaryUserId: string;
    readonly verticals: readonly string[];
}): Promise<readonly S13Row[]> {
    if (input.verticals.length === 0) return [];
    const rows = await input.tx
        .select({
            subscriptionId: subscriptions.id,
            userId: subscriptions.userId,
            vertical: subscriptions.vertical,
            origin: subscriptions.status,
            authorizationId: providerLinks.providerId,
            cardPayer: subscriptions.paymentMethod
        })
        .from(subscriptions)
        .leftJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
        .where(
            and(
                eq(subscriptions.userId, input.beneficiaryUserId),
                eq(subscriptions.class, 'PRINCIPAL'),
                inArray(subscriptions.status, LIVE_SUBSCRIPTION_STATUSES),
                inArray(subscriptions.vertical, [...input.verticals])
            )
        )
        .for('update', { of: subscriptions });
    return rows.map((row) => {
        if (!row.userId || !row.vertical || !isLiveStatus(row.origin))
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Invalid locked S13 subscription row'
            );
        return {
            subscriptionId: row.subscriptionId,
            userId: row.userId,
            vertical: row.vertical,
            origin: row.origin,
            authorizationId: row.authorizationId,
            cardPayer: row.cardPayer === 'CARD'
        };
    });
}

/** Guarded state write for G5; closes the open pause only when origin was PAUSED. */
async function writeS13Cancellation(input: {
    readonly tx: DrizzleClient;
    readonly row: S13Row;
    readonly now: Date;
}): Promise<void> {
    const { tx, row, now } = input;
    const [changed] = await tx
        .update(subscriptions)
        .set({
            status: 'CANCELLED',
            serviceEndsAt: now,
            graceStartedAt: null,
            graceEndsAt: null,
            updatedAt: now
        })
        .where(and(eq(subscriptions.id, row.subscriptionId), eq(subscriptions.status, row.origin)))
        .returning({ id: subscriptions.id });
    if (!changed)
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Permanent grant subscription changed while locked',
            undefined,
            'PERMANENT_GRANT_ROW_CHANGED'
        );
    if (CLOSES_OPEN_PAUSE[row.origin])
        await tx
            .update(subscriptionPauses)
            .set({ actualEndAt: now })
            .where(
                and(
                    eq(subscriptionPauses.subscriptionId, row.subscriptionId),
                    isNull(subscriptionPauses.actualEndAt)
                )
            );
}

export async function runS13InTransaction(
    input: {
        readonly tx: DrizzleClient;
        readonly permanentGrantId: string;
        readonly beneficiaryUserId: string;
        readonly verticals: readonly string[];
        readonly now: Date;
        readonly actorId: string;
    },
    ports: { readonly orphanhood: AddonOrphanhoodPorts }
): Promise<S13Result> {
    if (!z.uuid().safeParse(input.actorId).success)
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Invalid actor',
            undefined,
            'INVALID_PERMANENT_GRANT_INPUT'
        );
    const cancelled = await readS13Rows(input);
    for (const row of cancelled) await writeS13Cancellation({ tx: input.tx, row, now: input.now });
    const [grant] = await input.tx
        .select({ affected: permanentGrants.affectedSubscriptionIds })
        .from(permanentGrants)
        .where(eq(permanentGrants.id, input.permanentGrantId))
        .for('update');
    if (!grant) throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Permanent grant not found');
    const movedIds = cancelled.map(({ subscriptionId }) => subscriptionId);
    if (movedIds.length)
        await input.tx
            .update(permanentGrants)
            .set({
                affectedSubscriptionIds: [...new Set([...grant.affected, ...movedIds])],
                updatedAt: input.now
            })
            .where(eq(permanentGrants.id, input.permanentGrantId));
    const { releasedRetentionIds } = await permanentGrantRetentionRelease.releaseOnPermanentGrant({
        subscriptionIds: movedIds,
        now: input.now,
        tx: input.tx
    });
    const { closedCourtesyIds } = await closeDeferredCourtesyBalances({
        tx: input.tx,
        beneficiaryUserId: input.beneficiaryUserId,
        verticals: input.verticals,
        now: input.now
    });
    const orphanedAddons: CancelledAddon[] = [];
    for (const row of cancelled) {
        const result = await runOrphanhood(
            { tx: input.tx, subscriptionId: row.subscriptionId, now: input.now },
            ports.orphanhood
        );
        orphanedAddons.push(...result.cancelled);
    }
    return { cancelled, releasedRetentionIds, closedCourtesyIds, orphanedAddons };
}

/** Best-effort GRANT additions and moved subscription removals, after commit. */
export async function emitS13CoverageNotices(input: {
    readonly beneficiaryUserId: string;
    readonly anchoredVerticals: readonly string[];
    readonly movedVerticals: readonly string[];
    readonly coverageNotices: CoverageNotices;
}): Promise<void> {
    const seen = new Set<string>();
    const events: CoverageNotice[] = [
        ...input.anchoredVerticals.map(
            (vertical): CoverageNotice => ({ vertical, sourceType: 'GRANT', change: 'ADDED' })
        ),
        ...input.movedVerticals.map(
            (vertical): CoverageNotice => ({
                vertical,
                sourceType: 'SUBSCRIPTION',
                change: 'REMOVED'
            })
        )
    ];
    for (const event of events) {
        const key = `${event.sourceType}|${event.vertical}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const vertical = VerticalEnumSchema.safeParse(event.vertical);
        if (!vertical.success) {
            logger.error(
                { vertical: event.vertical },
                'Permanent grant coverage notice has invalid vertical'
            );
            continue;
        }
        try {
            await input.coverageNotices.emitCoverageChanged({
                userId: input.beneficiaryUserId,
                vertical: vertical.data,
                sourceType: event.sourceType,
                change: event.change
            });
        } catch (error) {
            logger.error(
                { vertical: event.vertical, error },
                'Permanent grant coverage notice failed after commit'
            );
        }
    }
}
