import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import {
    domainEventModel,
    getDb,
    PartnerModel,
    partnerPresenceHasContent,
    partners
} from '@repo/db';
import type { ImageProvider } from '@repo/media/server';
import type { Partner } from '@repo/schemas';
import { ServiceErrorCode } from '@repo/schemas';
import {
    type Actor,
    getRevalidationService,
    isSystemActor,
    ServiceError
} from '@repo/service-core';
import { isAdministrativeActionPermitted, resolveAdministrativeActionStep } from '@repo/verticals';
import { and, eq, isNull } from 'drizzle-orm';
import { getRequestCorrelationId } from '../../lib/request-context';
import { invalidateCacheByPathPrefix } from '../../middlewares/cache';
import { apiLogger } from '../../utils/logger';
import { classifyPartnerRemoteAssets } from './partner-presence-remote-assets';

const partnerModel = new PartnerModel();
const CONTENT_COLUMNS = [
    ['logo_url', 'logoUrl'],
    ['website_url', 'websiteUrl'],
    ['description', 'description'],
    ['contact_info', 'contactInfo'],
    ['social_networks', 'socialNetworks'],
    ['pending_logo_url', 'pendingLogoUrl'],
    ['pending_description', 'pendingDescription'],
    ['pending_website_url', 'pendingWebsiteUrl'],
    ['content_review_state', 'contentReviewState'],
    ['content_review_note', 'contentReviewNote']
] as const;

function authorize(actor: Actor, ownerUserId: string | null): void {
    const action = 'ACC_25' as const;
    const step = resolveAdministrativeActionStep({
        action,
        actorId: actor.id,
        subjectId: ownerUserId,
        permitted: isAdministrativeActionPermitted({ action, actorPermissions: actor.permissions }),
        isSystemActor: isSystemActor(actor)
    });
    if (!step.allowed) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');
}

function assetPlan(row: Partner, cloudName: string | null) {
    return classifyPartnerRemoteAssets({ urls: [row.logoUrl, row.pendingLogoUrl], cloudName });
}

function hasPresenceContent(row: Partner): boolean {
    return partnerPresenceHasContent({
        logoUrl: row.logoUrl ?? null,
        description: row.description ?? null,
        websiteUrl: row.websiteUrl ?? null,
        pendingLogoUrl: row.pendingLogoUrl ?? null,
        pendingDescription: row.pendingDescription ?? null,
        pendingWebsiteUrl: row.pendingWebsiteUrl ?? null,
        socialNetworks: row.socialNetworks ?? null,
        contactInfo: row.contactInfo ?? null
    });
}

/**
 * Empties ACC:25 presence content with remote deletion before the database transaction. This
 * ordering leaves the database intact when remote deletion fails; if the transaction later fails,
 * retry is safe because remote deletion is idempotent. It never touches billing, applications, or
 * the moderation bit.
 */
export async function emptyPartnerPresence(
    input: { readonly actor: Actor; readonly partnerId: string; readonly reason: string },
    deps: {
        readonly mediaProvider: Pick<ImageProvider, 'delete'> | null;
        readonly cloudName: string | null;
        readonly clock: { now(): Date };
    }
): Promise<{
    readonly id: string;
    readonly clearedFields: readonly string[];
    readonly remoteAssetsDeleted: number;
    readonly remoteAssetsSkipped: number;
}> {
    const reason = input.reason.trim();
    if (!reason) throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Reason required');

    const rows = await getDb()
        .select()
        .from(partners)
        .where(and(eq(partners.id, input.partnerId), isNull(partners.deletedAt)))
        .limit(1);
    const initial = rows[0] as Partner | undefined;
    if (!initial) throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Partner not found');
    authorize(input.actor, initial.ownerUserId ?? null);
    if (!hasPresenceContent(initial)) {
        throw new ServiceError(
            ServiceErrorCode.ALREADY_EXISTS,
            'Partner presence is already empty',
            undefined,
            'PRESENCE_ALREADY_EMPTY'
        );
    }

    const initialPlan = assetPlan(initial, deps.cloudName);
    if (initialPlan.publicIds.length > 0) {
        const mediaProvider = deps.mediaProvider;
        if (mediaProvider === null) {
            throw new ServiceError(
                ServiceErrorCode.SERVICE_UNAVAILABLE,
                'Remote media provider unavailable',
                undefined,
                'MEDIA_PROVIDER_UNAVAILABLE'
            );
        }
        for (const publicId of initialPlan.publicIds) {
            try {
                await mediaProvider.delete({ publicId });
            } catch (error) {
                apiLogger.error(
                    { partnerId: input.partnerId, error },
                    '[partner-presence] remote asset deletion failed'
                );
                throw new ServiceError(
                    ServiceErrorCode.SERVICE_UNAVAILABLE,
                    'Remote media deletion failed',
                    undefined,
                    'REMOTE_DELETE_FAILED'
                );
            }
        }
    }

    const partner = await getDb().transaction(async (rawTx) => {
        const tx = rawTx as DrizzleClient;
        const locked = await partnerModel.lockById({ tx, partnerId: input.partnerId });
        if (!locked) throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Partner not found');
        authorize(input.actor, locked.ownerUserId ?? null);
        if (!hasPresenceContent(locked)) {
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'Partner presence is already empty',
                undefined,
                'PRESENCE_ALREADY_EMPTY'
            );
        }
        const lockedPlan = assetPlan(locked, deps.cloudName);
        if (
            lockedPlan.publicIds.length !== initialPlan.publicIds.length ||
            lockedPlan.publicIds.some((id) => !initialPlan.publicIds.includes(id))
        ) {
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'Partner presence changed',
                undefined,
                'PRESENCE_STATE_CHANGED'
            );
        }
        const clearedFields = CONTENT_COLUMNS.filter(([, key]) => locked[key] !== null).map(
            ([field]) => field
        );
        const changes: Array<{ field: string; new?: number }> = clearedFields.map((field) => ({
            field
        }));
        if (initialPlan.publicIds.length > 0)
            changes.push({ field: 'remote_assets', new: initialPlan.publicIds.length });
        await partnerModel.emptyPresenceContent({ tx, partnerId: locked.id });
        await domainEventModel.insert({
            tx,
            eventType: 'partner.presence_emptied',
            entityType: 'partner',
            entityId: locked.id,
            actorType: 'admin',
            actorId: input.actor.id,
            reason,
            correlationId: getRequestCorrelationId() ?? randomUUID(),
            occurredAt: deps.clock.now(),
            changes
        });
        return { row: locked, clearedFields };
    });

    invalidateCacheByPathPrefix({ pathPrefix: '/api/v1/public/partners' });
    try {
        getRevalidationService()?.scheduleRevalidation({
            entityType: 'partner',
            id: partner.row.id,
            slug: partner.row.slug
        });
    } catch (error) {
        apiLogger.warn(
            { partnerId: partner.row.id, error },
            '[partner-presence] edge revalidation failed'
        );
    }
    return {
        id: partner.row.id,
        clearedFields: partner.clearedFields,
        remoteAssetsDeleted: initialPlan.publicIds.length,
        remoteAssetsSkipped: initialPlan.skipped
    };
}
