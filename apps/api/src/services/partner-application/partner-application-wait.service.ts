import { randomUUID } from 'node:crypto';
import {
    type DrizzleClient,
    domainEventModel,
    getDb,
    partnerApplicationModel,
    userModel
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { type Actor, isSystemActor, ServiceError } from '@repo/service-core';
import { isAdministrativeActionPermitted, resolveAdministrativeActionStep } from '@repo/verticals';
import { getRequestCorrelationId } from '../../lib/request-context';
import { getClock } from '../../utils/clock';
import { PARTNER_APPLICATION_WAIT_NOT_ACTIVE } from './partner-application-errors';

/** Cancels an active rejection wait as administrative action 5 (ACC:5). */
export async function cancelPartnerApplicationWait(input: {
    readonly actor: Actor;
    readonly applicationId: string;
    readonly reason: string;
}): Promise<{ readonly cancelled: true }> {
    const action = 'ACC_5' as const;
    const permitted = isAdministrativeActionPermitted({
        action,
        actorPermissions: input.actor.permissions
    });
    const step = resolveAdministrativeActionStep({
        action,
        actorId: input.actor.id,
        subjectId: null,
        permitted,
        isSystemActor: isSystemActor(input.actor)
    });
    if (!step.allowed) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');

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
        if (application.status !== 'REJECTED' || application.waitCancelledAt !== null) {
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'Partner application wait is not active',
                undefined,
                PARTNER_APPLICATION_WAIT_NOT_ACTIVE
            );
        }

        const at = getClock().clock.now();
        await partnerApplicationModel.cancelWait({
            tx,
            applicationId: input.applicationId,
            at,
            actorId: input.actor.id
        });
        await domainEventModel.insert({
            tx,
            eventType: 'partner_application.wait_cancelled',
            entityType: 'partner_application',
            entityId: input.applicationId,
            actorType: 'admin',
            actorId: input.actor.id,
            reason,
            correlationId: getRequestCorrelationId() ?? randomUUID(),
            occurredAt: at,
            changes: [{ field: 'wait_cancelled_at' }, { field: 'wait_cancelled_by' }]
        });
    });

    return { cancelled: true };
}
