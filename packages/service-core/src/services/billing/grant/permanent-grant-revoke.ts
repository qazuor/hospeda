/**
 * Revoke a permanent grant (DEC-GRANT-008). The grant and its anchors remain as
 * audit rows. The former debit is not resumed (DEC-GRANT-001), the trial is not
 * restored (DEC-TRIAL-009), and A5's grant clause turns off titled addons
 * (DEC-ADDON-005/006). No subscription or courtesy repair runs here.
 */
import {
    addonInstances,
    and,
    eq,
    getDb,
    inArray,
    isNull,
    permanentGrants,
    permanentGrantVerticals
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { ServiceErrorCode, VerticalEnumSchema } from '@repo/schemas';
import type { Actor } from '../../../types';
import { ServiceError } from '../../../types';
import {
    type AddonProviderCancellationResult,
    applyA5,
    type CancelledAddon,
    cancelAddonComplementsAtProvider,
    emitAddonCoverageRemoved
} from '../addon/addon-instance-a5.js';
import type { CoverageNotices } from '../payment/payment-ports.js';
import {
    assertPermanentGrantPermitted,
    assertPermanentGrantSubject,
    mapPermanentGrantWriteError,
    permanentGrantRejection
} from './permanent-grant-authorization.js';
import { invalidPermanentGrantInput, revokeSchema } from './permanent-grant-inputs.js';
import type { PermanentGrantPorts } from './permanent-grant-ports.js';

const logger = createLogger('permanent-grant-revoke');

async function emitGrantRevokedNotices(input: {
    readonly beneficiaryUserId: string;
    readonly verticals: readonly string[];
    readonly coverageNotices: CoverageNotices;
}): Promise<void> {
    const seen = new Set<string>();
    for (const raw of input.verticals) {
        if (seen.has(raw)) continue;
        seen.add(raw);
        const vertical = VerticalEnumSchema.safeParse(raw);
        if (!vertical.success) {
            logger.error({ vertical: raw }, 'Revoked grant has invalid coverage vertical');
            continue;
        }
        try {
            await input.coverageNotices.emitCoverageChanged({
                userId: input.beneficiaryUserId,
                vertical: vertical.data,
                sourceType: 'GRANT',
                change: 'REMOVED'
            });
        } catch (error) {
            logger.error({ vertical: raw, error }, 'Grant removal notice failed after commit');
        }
    }
}

/**
 * Revoke one live grant, retaining its reason, signer and instant together.
 * A5 cancels every live addon titled by one of its anchors in the same transaction.
 * Post-commit notices and provider cancellation are best effort. No S13/S20,
 * subscription reactivation, courtesy repair or trial transition runs here.
 * Rejection order is 403 permission, 422 shape, 404 missing row, 403 subject
 * or system actor, then 422 non-live grant, then 409
 * `PERMANENT_GRANT_LISTING_SOFT_DELETED` when a titled addon targets a
 * soft-deleted listing (nothing is revoked).
 *
 * @param input Grant ID, required free-text reason and signing actor.
 * @param ports Clock, A5 policy, coverage notices and provider dependencies.
 * @returns Revocation audit data, retained anchor IDs, cancelled addons and provider calls.
 * @throws {ServiceError} ADMINISTRATIVE_ACTION_FORBIDDEN, INVALID_PERMANENT_GRANT_INPUT,
 * PERMANENT_GRANT_NOT_FOUND, PERMANENT_GRANT_NOT_LIVE,
 * PERMANENT_GRANT_LISTING_SOFT_DELETED, or internal
 * PERMANENT_GRANT_ROW_CHANGED when a locked row changes unexpectedly.
 */
export async function revokePermanentGrant(
    input: {
        readonly permanentGrantId: string;
        readonly reason: string;
        readonly actor: Actor;
    },
    ports: PermanentGrantPorts
): Promise<{
    readonly permanentGrantId: string;
    readonly revokedAt: Date;
    readonly anchorIds: readonly string[];
    readonly revokedVerticals: readonly string[];
    readonly cancelledAddonInstanceIds: readonly string[];
    readonly addonProviderCalls: readonly AddonProviderCancellationResult[];
}> {
    assertPermanentGrantPermitted({ actor: input.actor });
    const parsed = revokeSchema.safeParse({
        permanentGrantId: input.permanentGrantId,
        reason: input.reason,
        revokedBy: input.actor.id
    });
    if (!parsed.success) throw invalidPermanentGrantInput(parsed.error.issues);
    const now = ports.clock.now();
    const committed = await getDb()
        .transaction(async (tx) => {
            const [grant] = await tx
                .select({
                    id: permanentGrants.id,
                    beneficiaryUserId: permanentGrants.beneficiaryUserId,
                    revokedAt: permanentGrants.revokedAt
                })
                .from(permanentGrants)
                .where(eq(permanentGrants.id, parsed.data.permanentGrantId))
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
            const [written] = await tx
                .update(permanentGrants)
                .set({
                    revokedAt: now,
                    revokedBy: parsed.data.revokedBy,
                    revocationReason: parsed.data.reason
                })
                .where(and(eq(permanentGrants.id, grant.id), isNull(permanentGrants.revokedAt)))
                .returning({ id: permanentGrants.id });
            if (!written)
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'Permanent grant row changed while locked',
                    undefined,
                    'PERMANENT_GRANT_ROW_CHANGED'
                );
            const anchors = await tx
                .select({
                    id: permanentGrantVerticals.id,
                    vertical: permanentGrantVerticals.vertical
                })
                .from(permanentGrantVerticals)
                .where(eq(permanentGrantVerticals.permanentGrantId, grant.id));
            const anchorIds = anchors.map(({ id }) => id);
            const instances = anchorIds.length
                ? await tx
                      .select({ id: addonInstances.id })
                      .from(addonInstances)
                      .where(
                          and(
                              inArray(addonInstances.titleAnchorId, anchorIds),
                              inArray(addonInstances.status, ['PENDING_AUTHORIZATION', 'ACTIVE'])
                          )
                      )
                      .orderBy(addonInstances.id)
                : [];
            const cancelled: CancelledAddon[] = [];
            for (const instance of instances) {
                let result: Awaited<ReturnType<typeof applyA5>>;
                try {
                    result = await applyA5(
                        {
                            tx,
                            instanceId: instance.id,
                            clause: 'GRANT_REVOKED',
                            now,
                            s21Cause: 'GRANT_REVOKED'
                        },
                        ports.orphanhood
                    );
                } catch (error) {
                    // A titled LISTING addon whose listing row is soft-deleted (legacy data:
                    // the new model has no soft-delete door, AC:V6:25) makes `ficha` refuse.
                    // Fail closed (owner, HOS-2069): throwing here rolls back the grant, its
                    // anchors and every addon already cancelled in this loop.
                    if (error instanceof Error && error.name === 'ListingNotFoundError')
                        throw permanentGrantRejection({
                            reason: 'PERMANENT_GRANT_LISTING_SOFT_DELETED',
                            message: 'A titled addon targets a deleted listing; nothing was revoked'
                        });
                    throw error;
                }
                if (result.outcome === 'CANCELLED') cancelled.push(result.addon);
            }
            return { beneficiaryUserId: grant.beneficiaryUserId, anchors, cancelled };
        })
        .catch((error: unknown) => mapPermanentGrantWriteError({ error }));
    const revokedVerticals = [...new Set(committed.anchors.map(({ vertical }) => vertical))];
    await emitGrantRevokedNotices({
        beneficiaryUserId: committed.beneficiaryUserId,
        verticals: revokedVerticals,
        coverageNotices: ports.coverageNotices
    });
    if (committed.cancelled.length > 0)
        await emitAddonCoverageRemoved({
            cancelled: committed.cancelled,
            coverageNotices: ports.coverageNotices
        });
    const provider =
        committed.cancelled.length > 0
            ? await cancelAddonComplementsAtProvider({ cancelled: committed.cancelled }, ports)
            : { results: [] };
    return {
        permanentGrantId: parsed.data.permanentGrantId,
        revokedAt: now,
        anchorIds: committed.anchors.map(({ id }) => id),
        revokedVerticals,
        cancelledAddonInstanceIds: committed.cancelled.map(({ instanceId }) => instanceId),
        addonProviderCalls: provider.results
    };
}
