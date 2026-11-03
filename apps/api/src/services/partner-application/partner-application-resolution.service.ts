import { randomUUID } from 'node:crypto';
import {
    type DrizzleClient,
    domainEventModel,
    getDb,
    partnerApplicationModel,
    userModel,
    users
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { type Actor, ServiceError } from '@repo/service-core';
import { toSlug } from '@repo/utils';
import { eq } from 'drizzle-orm';
import { getRequestCorrelationId } from '../../lib/request-context';
import { getClock } from '../../utils/clock';
import { apiLogger } from '../../utils/logger';
import { PARTNER_APPLICATION_NOT_PENDING } from './partner-application-errors';
import {
    enqueuePartnerApplicationRejectedNotice,
    enqueuePartnerClaimNotice
} from './partner-application-notices';
import { assertAction5Step3 } from './partner-application-step3';
import { createClaimAccount } from './partner-claim-account';

/** Approves a pending application and creates an unclaimed draft Partner. */
export async function approvePartnerApplication(input: {
    readonly actor: Actor;
    readonly applicationId: string;
    readonly reason: string;
    readonly name: string;
    readonly type: 'business' | 'ngo' | 'institution';
}): Promise<{ readonly approved: true; readonly partnerId: string }> {
    assertAction5Step3({ actor: input.actor });
    const reason = input.reason.trim();
    if (reason.length === 0) {
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Reason required');
    }

    const db = getDb();
    const preflight = await partnerApplicationModel.readById({
        tx: db as DrizzleClient,
        applicationId: input.applicationId
    });
    if (!preflight)
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Partner application not found');
    if (preflight.status !== 'PENDING') {
        throw new ServiceError(
            ServiceErrorCode.ALREADY_EXISTS,
            'Partner application is not pending',
            undefined,
            PARTNER_APPLICATION_NOT_PENDING
        );
    }
    const preflightActor = await userModel.findById(input.actor.id, db as DrizzleClient);
    if (!preflightActor || preflightActor.email.toLowerCase() === preflight.email.toLowerCase()) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');
    }
    const existingAccount = await partnerApplicationModel.findAccountIdByEmail({
        tx: db as DrizzleClient,
        email: preflight.email
    });
    const createdUserId = existingAccount
        ? null
        : await createClaimAccount({ email: preflight.email });

    try {
        const partnerId = await db.transaction(async (rawTx) => {
            const tx = rawTx as DrizzleClient;
            const application = await partnerApplicationModel.lockById({
                tx,
                applicationId: input.applicationId
            });
            if (!application)
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Partner application not found');

            const actorRow = await userModel.findById(input.actor.id, tx);
            if (!actorRow || actorRow.email.toLowerCase() === application.email.toLowerCase()) {
                throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');
            }
            if (application.status !== 'PENDING') {
                throw new ServiceError(
                    ServiceErrorCode.ALREADY_EXISTS,
                    'Partner application is not pending',
                    undefined,
                    PARTNER_APPLICATION_NOT_PENDING
                );
            }

            const at = getClock().clock.now();
            const partner = await partnerApplicationModel.insertUnclaimedPartner({
                tx,
                name: input.name,
                slug: `${toSlug(input.name) || 'partner'}-${randomUUID().slice(0, 8)}`,
                type: input.type,
                actorId: input.actor.id
            });
            await partnerApplicationModel.markApproved({
                tx,
                applicationId: input.applicationId,
                at,
                partnerId: partner.id
            });
            const correlationId = getRequestCorrelationId() ?? randomUUID();
            if (createdUserId === null) {
                await enqueuePartnerClaimNotice({
                    tx,
                    email: application.email,
                    partnerId: partner.id,
                    partnerName: input.name,
                    correlationId
                });
            }
            await domainEventModel.insert({
                tx,
                eventType: 'partner_application.approved',
                entityType: 'partner_application',
                entityId: input.applicationId,
                actorType: 'admin',
                actorId: input.actor.id,
                reason,
                correlationId,
                occurredAt: at,
                changes: [
                    { field: 'status', old: 'PENDING', new: 'APPROVED' },
                    { field: 'resolved_at' },
                    { field: 'partner_id', new: partner.id },
                    ...(createdUserId
                        ? [{ field: 'claim_account_user_id', new: createdUserId }]
                        : [])
                ]
            });
            return partner.id;
        });

        return { approved: true, partnerId };
    } catch (error) {
        if (createdUserId) {
            try {
                await db.delete(users).where(eq(users.id, createdUserId));
            } catch (cleanupError) {
                apiLogger.error(
                    {
                        userId: createdUserId,
                        error:
                            cleanupError instanceof Error
                                ? cleanupError.message
                                : String(cleanupError)
                    },
                    'Failed to delete claim account after approval failed'
                );
            }
        }
        throw error;
    }
}

/** Rejects a pending application and starts its configured resubmission wait. */
export async function rejectPartnerApplication(input: {
    readonly actor: Actor;
    readonly applicationId: string;
    readonly reason: string;
}): Promise<{ readonly rejected: true }> {
    assertAction5Step3({ actor: input.actor });
    const reason = input.reason.trim();
    if (reason.length === 0) {
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Reason required');
    }

    await getDb().transaction(async (rawTx) => {
        const tx = rawTx as DrizzleClient;
        const application = await partnerApplicationModel.lockById({
            tx,
            applicationId: input.applicationId
        });
        if (!application)
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Partner application not found');

        const actorRow = await userModel.findById(input.actor.id, tx);
        if (!actorRow || actorRow.email.toLowerCase() === application.email.toLowerCase()) {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');
        }
        if (application.status !== 'PENDING') {
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'Partner application is not pending',
                undefined,
                PARTNER_APPLICATION_NOT_PENDING
            );
        }

        const at = getClock().clock.now();
        await partnerApplicationModel.markRejected({
            tx,
            applicationId: input.applicationId,
            at
        });
        const correlationId = getRequestCorrelationId() ?? randomUUID();
        await enqueuePartnerApplicationRejectedNotice({
            tx,
            email: application.email,
            applicationId: input.applicationId,
            correlationId
        });
        await domainEventModel.insert({
            tx,
            eventType: 'partner_application.rejected',
            entityType: 'partner_application',
            entityId: input.applicationId,
            actorType: 'admin',
            actorId: input.actor.id,
            reason,
            correlationId,
            occurredAt: at,
            changes: [
                { field: 'status', old: 'PENDING', new: 'REJECTED' },
                { field: 'resolved_at' },
                { field: 'deadlines_version' }
            ]
        });
    });

    return { rejected: true };
}
