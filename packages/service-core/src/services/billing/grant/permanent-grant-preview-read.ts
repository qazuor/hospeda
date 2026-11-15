import {
    addonInstances,
    addonProducts,
    addons,
    and,
    courtesyGrants,
    type DrizzleClient,
    eq,
    inArray,
    isNull,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import type { S13Row } from './permanent-grant-s13.js';
import type { S20Row } from './permanent-grant-s20.js';

/** Open courtesy pauses are captured before S13 closes them in the same transaction. */
export async function readOpenCourtesies(input: {
    readonly tx: DrizzleClient;
    readonly beneficiaryUserId: string;
    readonly verticals: readonly string[];
}): Promise<ReadonlyMap<string, Date>> {
    if (input.verticals.length === 0) return new Map();
    const rows = await input.tx
        .select({ subscriptionId: subscriptions.id, endsAt: courtesyGrants.endsAt })
        .from(subscriptions)
        .innerJoin(subscriptionPauses, eq(subscriptionPauses.subscriptionId, subscriptions.id))
        .innerJoin(courtesyGrants, eq(courtesyGrants.subscriptionId, subscriptions.id))
        .where(
            and(
                eq(subscriptions.userId, input.beneficiaryUserId),
                inArray(subscriptions.vertical, [...input.verticals]),
                eq(subscriptions.status, 'PAUSED'),
                eq(subscriptionPauses.reason, 'COURTESY'),
                isNull(subscriptionPauses.actualEndAt),
                isNull(courtesyGrants.balanceMonths)
            )
        );
    return new Map(rows.map(({ subscriptionId, endsAt }) => [subscriptionId, endsAt]));
}

/** The projected local effects. Provider email is a prediction, not a delivery receipt. */
export async function readPermanentGrantEffects(input: {
    readonly tx: DrizzleClient;
    readonly cancelled: readonly S13Row[];
    readonly closedCourtesyIds: readonly string[];
    readonly converted: readonly S20Row[];
    readonly openCourtesies: ReadonlyMap<string, Date>;
}): Promise<{
    readonly stoppedCharges: readonly {
        readonly subscriptionId: string;
        readonly vertical: string;
        readonly status: S13Row['origin'];
        readonly providerEmail: boolean;
    }[];
    readonly endingCourtesies: readonly {
        readonly subscriptionId: string;
        readonly vertical: string;
        readonly endsAt: Date;
        readonly providerEmail: boolean;
    }[];
    readonly closedDeferredBalances: readonly {
        readonly courtesyGrantId: string;
        readonly vertical: string;
        readonly balanceMonths: number;
    }[];
    readonly convertedAddons: readonly {
        readonly addonInstanceId: string;
        readonly addonName: string;
        readonly complementSubscriptionId: string;
        readonly providerEmail: boolean;
    }[];
}> {
    const closed = input.closedCourtesyIds.length
        ? await input.tx
              .select({
                  courtesyGrantId: courtesyGrants.id,
                  vertical: subscriptions.vertical,
                  balanceMonths: courtesyGrants.balanceMonths
              })
              .from(courtesyGrants)
              .innerJoin(subscriptions, eq(subscriptions.id, courtesyGrants.subscriptionId))
              .where(inArray(courtesyGrants.id, [...input.closedCourtesyIds]))
        : [];
    const names = input.converted.length
        ? await input.tx
              .select({ instanceId: addonInstances.id, addonName: addons.name })
              .from(addonInstances)
              .innerJoin(addonProducts, eq(addonProducts.id, addonInstances.productId))
              .innerJoin(addons, eq(addons.id, addonProducts.addonId))
              .where(
                  inArray(
                      addonInstances.id,
                      input.converted.map(({ instanceId }) => instanceId)
                  )
              )
        : [];
    const nameById = new Map(names.map(({ instanceId, addonName }) => [instanceId, addonName]));
    return {
        stoppedCharges: input.cancelled.map((row) => ({
            subscriptionId: row.subscriptionId,
            vertical: row.vertical,
            status: row.origin,
            providerEmail: row.cardPayer && row.authorizationId !== null
        })),
        endingCourtesies: input.cancelled.flatMap((row) => {
            const endsAt = input.openCourtesies.get(row.subscriptionId);
            return row.origin === 'PAUSED' && endsAt
                ? [
                      {
                          subscriptionId: row.subscriptionId,
                          vertical: row.vertical,
                          endsAt,
                          providerEmail: row.cardPayer && row.authorizationId !== null
                      }
                  ]
                : [];
        }),
        closedDeferredBalances: closed.map((row) => {
            if (row.balanceMonths === null || row.vertical === null)
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'Invalid closed courtesy balance'
                );
            return {
                courtesyGrantId: row.courtesyGrantId,
                vertical: row.vertical,
                balanceMonths: row.balanceMonths
            };
        }),
        convertedAddons: input.converted.map((row) => {
            const addonName = nameById.get(row.instanceId);
            if (addonName === undefined)
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'Converted addon name missing'
                );
            return {
                addonInstanceId: row.instanceId,
                addonName,
                complementSubscriptionId: row.subscriptionId,
                providerEmail: row.cardPayer && row.authorizationId !== null
            };
        })
    };
}
