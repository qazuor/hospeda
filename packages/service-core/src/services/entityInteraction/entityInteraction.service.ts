/**
 * Public write behind the listing interaction beacon (HOS-2256).
 *
 * Deliberately NOT a `BaseCrudService`: `entity_interactions` is append-only
 * telemetry with no update, no soft delete and no list-by-id. Capture takes no
 * permission (anonymous public write), like `EntityViewService.capture`.
 *
 * ## Everything is silent towards the caller
 *
 * A listing that does not exist, is not published, an event that belongs to
 * another listing, the owner's own tap and a DB error all come back as
 * `recorded: false` with a `reason`. The ROUTE answers 202 in every case, so
 * no response can be used as an oracle for "this id exists". The `reason` is for
 * tests and server logs only.
 *
 * The existence check is what makes the number worth anything: without it a
 * script can inflate the CTR of any venue by posting ids.
 *
 * @module services/entityInteraction/entityInteraction.service
 */

import { EntityInteractionModel, VenueEventModel, VenueModel } from '@repo/db';
import {
    type EntityInteractionKind,
    PublicationStatusEnum,
    type TrackableInteractionEntityType
} from '@repo/schemas';
import type { ServiceConfig } from '../../types';

/** Why an interaction was not recorded. Never exposed over HTTP. */
export type InteractionDropReason =
    | 'LISTING_NOT_FOUND'
    | 'LISTING_NOT_PUBLISHED'
    | 'EVENT_NOT_OF_LISTING'
    | 'OWNER_INTERACTION'
    | 'DB_ERROR';

/** Typed result of {@link EntityInteractionService.capture}. */
export interface CaptureInteractionResult {
    /** Whether a row was inserted. */
    readonly recorded: boolean;
    /** Present when `recorded` is false. */
    readonly reason?: InteractionDropReason;
}

/** Input to {@link EntityInteractionService.capture}. */
export interface CaptureInteractionInput {
    /** Entity type; only VENUE today. */
    readonly entityType: TrackableInteractionEntityType;
    /** UUID of the listing. */
    readonly entityId: string;
    /** What the visitor did. */
    readonly kind: EntityInteractionKind;
    /** Venue event, for event kinds. */
    readonly eventId?: string | undefined;
    /** Server-computed visitor hash. Never accepted from the client. */
    readonly visitorHash: string;
    /** Authenticated user id, or `null` for guests. Used ONLY to drop the owner's own taps. */
    readonly actorUserId: string | null;
}

/**
 * Service that records listing interactions.
 */
export class EntityInteractionService {
    private modelLazy: EntityInteractionModel | undefined;
    private venueModelLazy: VenueModel | undefined;
    private eventModelLazy: VenueEventModel | undefined;
    private readonly overrides: {
        model?: EntityInteractionModel;
        venueModel?: VenueModel;
        eventModel?: VenueEventModel;
    };
    private readonly logger: ServiceConfig['logger'];

    /**
     * Models are resolved lazily, not at construction: the capture route builds
     * this service at module scope, so an eager `new VenueModel()` would make
     * every suite that mounts the router and mocks `@repo/db` fail at import.
     */
    constructor(
        ctx: ServiceConfig & {
            model?: EntityInteractionModel;
            venueModel?: VenueModel;
            eventModel?: VenueEventModel;
        } = {}
    ) {
        this.overrides = {
            ...(ctx.model ? { model: ctx.model } : {}),
            ...(ctx.venueModel ? { venueModel: ctx.venueModel } : {}),
            ...(ctx.eventModel ? { eventModel: ctx.eventModel } : {})
        };
        this.logger = ctx.logger;
    }

    private get model(): EntityInteractionModel {
        this.modelLazy ??= this.overrides.model ?? new EntityInteractionModel();
        return this.modelLazy;
    }

    private get venueModel(): VenueModel {
        this.venueModelLazy ??= this.overrides.venueModel ?? new VenueModel();
        return this.venueModelLazy;
    }

    private get eventModel(): VenueEventModel {
        this.eventModelLazy ??= this.overrides.eventModel ?? new VenueEventModel();
        return this.eventModelLazy;
    }

    /**
     * Records one interaction, or drops it silently.
     *
     * Steps: (1) the listing must exist, be published and not be deleted;
     * (2) an `eventId` must belong to that listing; (3) the owner's own taps do
     * not count; (4) insert.
     *
     * @param input - See {@link CaptureInteractionInput}.
     * @returns `{ recorded: true }`, or `{ recorded: false, reason }`. Never throws.
     */
    public async capture(input: CaptureInteractionInput): Promise<CaptureInteractionResult> {
        const { entityId, eventId, kind, actorUserId } = input;
        try {
            const venue = await this.venueModel.findOne({ id: entityId });
            if (!venue || venue.deletedAt) {
                return { recorded: false, reason: 'LISTING_NOT_FOUND' };
            }
            if (venue.publicationStatus !== PublicationStatusEnum.PUBLISHED) {
                return { recorded: false, reason: 'LISTING_NOT_PUBLISHED' };
            }

            if (eventId) {
                const event = await this.eventModel.findOne({ id: eventId, venueId: entityId });
                if (!event) {
                    return { recorded: false, reason: 'EVENT_NOT_OF_LISTING' };
                }
            }

            if (actorUserId !== null && venue.ownerId === actorUserId) {
                return { recorded: false, reason: 'OWNER_INTERACTION' };
            }

            await this.model.insertInteraction({
                entityType: input.entityType,
                entityId,
                kind,
                eventId,
                visitorHash: input.visitorHash
            });
            return { recorded: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            // `visitorHash` is deliberately absent from this line (privacy contract,
            // docs/guides/view-tracking-privacy.md).
            this.logger?.error(
                { entityType: input.entityType, entityId, kind },
                `Entity interaction capture failed: ${message}`
            );
            return { recorded: false, reason: 'DB_ERROR' };
        }
    }
}
