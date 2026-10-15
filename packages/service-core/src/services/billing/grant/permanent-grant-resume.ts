import {
    eq,
    getDb,
    inArray,
    permanentGrants,
    permanentGrantVerticals,
    providerLinks,
    subscriptions
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../../types';
import { ServiceError } from '../../../types';
import {
    cancelAddonComplementsAtProvider,
    emitAddonCoverageRemoved
} from '../addon/addon-instance-a5.js';
import {
    assertPermanentGrantPermitted,
    assertPermanentGrantSubject,
    mapPermanentGrantWriteError
} from './permanent-grant-authorization.js';
import type { PermanentGrantPorts } from './permanent-grant-ports.js';
import {
    cancelS13AtProvider,
    emitS13CoverageNotices,
    runS13InTransaction,
    type S13CancelCall
} from './permanent-grant-s13.js';
import {
    cancelS20AtProvider,
    runS20InTransaction,
    type S20ProviderResult
} from './permanent-grant-s20.js';

/**
 * Re-run the complete grant act for newly affected rows (TRANS:B:S13).
 *
 * @param input Grant ID and authorizing actor.
 * @param ports Clock and integrations required for local and post-commit work.
 * @returns The grant ID and provider results.
 * @throws {ServiceError} For ADMINISTRATIVE_ACTION_FORBIDDEN, a missing or revoked grant, or failed transaction.
 */
export async function resumePermanentGrant(
    input: { readonly permanentGrantId: string; readonly actor: Actor },
    ports: PermanentGrantPorts
): Promise<{
    readonly permanentGrantId: string;
    readonly providerCalls: readonly {
        readonly subscriptionId: string;
        readonly cancelCall: S13CancelCall;
        readonly escalated?: 'NO_RECIPIENT' | 'DELIVERY_EXHAUSTED';
    }[];
    readonly addonProviderCalls: readonly S20ProviderResult[];
}> {
    assertPermanentGrantPermitted({ actor: input.actor });
    const now = ports.clock.now();
    const committed = await getDb()
        .transaction(async (tx) => {
            const [grant] = await tx
                .select({
                    id: permanentGrants.id,
                    beneficiaryUserId: permanentGrants.beneficiaryUserId,
                    affected: permanentGrants.affectedSubscriptionIds,
                    revokedAt: permanentGrants.revokedAt,
                    includesAddons: permanentGrants.includesAddons
                })
                .from(permanentGrants)
                .where(eq(permanentGrants.id, input.permanentGrantId))
                .for('update');
            if (!grant)
                throw new ServiceError(
                    ServiceErrorCode.NOT_FOUND,
                    'Permanent grant not found',
                    undefined,
                    'PERMANENT_GRANT_NOT_FOUND'
                );
            assertPermanentGrantSubject({
                actor: input.actor,
                beneficiaryUserId: grant.beneficiaryUserId
            });
            if (grant.revokedAt !== null)
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    'Permanent grant is not live',
                    undefined,
                    'PERMANENT_GRANT_NOT_LIVE'
                );
            const anchors = await tx
                .select({
                    id: permanentGrantVerticals.id,
                    vertical: permanentGrantVerticals.vertical
                })
                .from(permanentGrantVerticals)
                .where(eq(permanentGrantVerticals.permanentGrantId, grant.id));
            const local = await runS13InTransaction(
                {
                    tx,
                    permanentGrantId: grant.id,
                    beneficiaryUserId: grant.beneficiaryUserId,
                    verticals: anchors.map(({ vertical }) => vertical),
                    now,
                    actorId: input.actor.id
                },
                { orphanhood: ports.orphanhood }
            );
            const s20 = await runS20InTransaction(
                {
                    tx,
                    includesAddons: grant.includesAddons,
                    permanentGrantId: grant.id,
                    beneficiaryUserId: grant.beneficiaryUserId,
                    anchors,
                    now,
                    actorId: input.actor.id
                },
                { orphanhood: ports.orphanhood }
            );
            const ids = [
                ...new Set([
                    ...grant.affected,
                    ...local.cancelled.map(({ subscriptionId }) => subscriptionId),
                    ...s20.rows.map(({ subscriptionId }) => subscriptionId)
                ])
            ];
            const rows = ids.length
                ? await tx
                      .select({
                          subscriptionId: subscriptions.id,
                          userId: subscriptions.userId,
                          vertical: subscriptions.vertical,
                          class: subscriptions.class,
                          origin: subscriptions.status,
                          authorizationId: providerLinks.providerId,
                          cardPayer: subscriptions.paymentMethod
                      })
                      .from(subscriptions)
                      .leftJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
                      .where(inArray(subscriptions.id, ids))
                : [];
            const providerRows = rows.map((row) => {
                const userId = row.userId;
                const vertical = row.vertical;
                if (typeof userId !== 'string' || typeof vertical !== 'string')
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Invalid affected S13 subscription row'
                    );
                return {
                    ...row,
                    userId,
                    vertical,
                    origin: 'CANCELLED' as const,
                    cardPayer: row.cardPayer === 'CARD'
                };
            });
            return { grant, local, s20, rows: providerRows };
        })
        .catch((error: unknown) => mapPermanentGrantWriteError({ error }));
    await emitS13CoverageNotices({
        beneficiaryUserId: committed.grant.beneficiaryUserId,
        anchoredVerticals: [],
        movedVerticals: committed.local.cancelled.map(({ vertical }) => vertical),
        coverageNotices: ports.coverageNotices
    });
    const principalRows = committed.rows.filter(({ class: rowClass }) => rowClass === 'PRINCIPAL');
    const complementRows = committed.rows
        .filter(({ class: rowClass }) => rowClass === 'COMPLEMENTO')
        .map(({ subscriptionId, userId, authorizationId, cardPayer }) => ({
            subscriptionId,
            userId,
            authorizationId,
            cardPayer
        }));
    const providerResult = await cancelS13AtProvider({ rows: principalRows }, ports);
    const addonProviderCalls = await cancelS20AtProvider({ rows: complementRows }, ports);
    if (committed.local.orphanedAddons.length > 0) {
        await emitAddonCoverageRemoved({
            cancelled: committed.local.orphanedAddons,
            coverageNotices: ports.coverageNotices
        });
        await cancelAddonComplementsAtProvider(
            { cancelled: committed.local.orphanedAddons },
            ports
        );
    }
    return {
        permanentGrantId: committed.grant.id,
        providerCalls: providerResult.results,
        addonProviderCalls
    };
}
