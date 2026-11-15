import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { domainEventModel, getDb, PartnerModel } from '@repo/db';
import type { PartnerPresenceModeration } from '@repo/schemas';
import { ServiceErrorCode } from '@repo/schemas';
import {
    type Actor,
    getRevalidationService,
    isSystemActor,
    ServiceError
} from '@repo/service-core';
import { isAdministrativeActionPermitted, resolveAdministrativeActionStep } from '@repo/verticals';
import { getRequestCorrelationId } from '../../lib/request-context';
import { invalidateCacheByPathPrefix } from '../../middlewares/cache';
import { getClock } from '../../utils/clock';
import { apiLogger } from '../../utils/logger';

const partnerModel = new PartnerModel();

/** Applies ACC:12 (sources: action 13) to a Partner presence, AC:V7:14; V7 §1.6. */
export async function moderatePartnerPresence(input: {
    readonly actor: Actor;
    readonly partnerId: string;
    readonly action: PartnerPresenceModeration['action'];
    readonly reason: string;
}): Promise<{ readonly id: string; readonly presenceModerated: boolean }> {
    const reason = input.reason.trim();
    if (reason.length === 0)
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Reason required');

    const presenceModerated = input.action === 'MODERATE';
    const partner = await getDb().transaction(async (rawTx) => {
        const tx = rawTx as DrizzleClient;
        const row = await partnerModel.lockById({ tx, partnerId: input.partnerId });
        if (!row) throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Partner not found');
        const action = 'ACC_12' as const;
        const step = resolveAdministrativeActionStep({
            action,
            actorId: input.actor.id,
            subjectId: row.ownerUserId ?? null,
            permitted: isAdministrativeActionPermitted({
                action,
                actorPermissions: input.actor.permissions
            }),
            isSystemActor: isSystemActor(input.actor)
        });
        if (!step.allowed) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');
        if (row.presenceModerated === presenceModerated) {
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'Partner presence moderation is unchanged'
            );
        }
        await partnerModel.setPresenceModerated({
            tx,
            partnerId: input.partnerId,
            moderated: presenceModerated
        });
        const occurredAt = getClock().clock.now();
        await domainEventModel.insert({
            tx,
            eventType: 'partner.presence_moderation_changed',
            entityType: 'partner',
            entityId: row.id,
            actorType: 'admin',
            actorId: input.actor.id,
            reason,
            correlationId: getRequestCorrelationId() ?? randomUUID(),
            occurredAt,
            changes: [
                { field: 'presence_moderated', old: row.presenceModerated, new: presenceModerated }
            ]
        });
        return row;
    });

    try {
        getRevalidationService()?.scheduleRevalidation({
            entityType: 'partner',
            id: partner.id,
            slug: partner.slug
        });
    } catch (error) {
        apiLogger.warn(
            { partnerId: partner.id, error },
            '[partner-presence] edge revalidation failed'
        );
    }
    invalidateCacheByPathPrefix({ pathPrefix: '/api/v1/public/partners' });
    return { id: partner.id, presenceModerated };
}
