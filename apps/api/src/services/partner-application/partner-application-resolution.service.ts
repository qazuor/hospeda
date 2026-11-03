import { randomUUID } from 'node:crypto';
import {
    type DrizzleClient,
    domainEventModel,
    getDb,
    partnerApplicationModel,
    userModel
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { type Actor, ServiceError } from '@repo/service-core';
import { toSlug } from '@repo/utils';
import { getRequestCorrelationId } from '../../lib/request-context';
import { getClock } from '../../utils/clock';
import { PARTNER_APPLICATION_NOT_PENDING } from './partner-application-errors';
import { assertAction5Step3 } from './partner-application-step3';

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

    const partnerId = await getDb().transaction(async (rawTx) => {
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
        await domainEventModel.insert({
            tx,
            eventType: 'partner_application.approved',
            entityType: 'partner_application',
            entityId: input.applicationId,
            actorType: 'admin',
            actorId: input.actor.id,
            reason,
            correlationId: getRequestCorrelationId() ?? randomUUID(),
            occurredAt: at,
            changes: [
                { field: 'status', old: 'PENDING', new: 'APPROVED' },
                { field: 'resolved_at' },
                { field: 'partner_id', new: partner.id }
            ]
        });
        return partner.id;
    });

    return { approved: true, partnerId };
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
        await domainEventModel.insert({
            tx,
            eventType: 'partner_application.rejected',
            entityType: 'partner_application',
            entityId: input.applicationId,
            actorType: 'admin',
            actorId: input.actor.id,
            reason,
            correlationId: getRequestCorrelationId() ?? randomUUID(),
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
